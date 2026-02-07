const { app, BrowserWindow, screen, Menu, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const isDev = process.env.NODE_ENV === 'development';
const ALLOWED_TABLES = ['employees', 'departments', 'leaves', 'users', 'logs'];

// مسار قاعدة البيانات في مجلد بيانات التطبيق لضمان الاستمرارية
const dbPath = path.join(app.getPath('userData'), 'leave_system_pro_v2.db');
const db = new Database(dbPath);

// تهيئة قاعدة البيانات وجداولها
function initDatabase() {
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      fullName TEXT,
      password TEXT,
      role TEXT,
      permissions TEXT,
      mustChangePassword INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1
    )`).run();

    // التأكد من وجود مدير افتراضي
    const row = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = ?").get('admin');
    if (row.count === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      const adminPerms = JSON.stringify({
        viewDashboard: true,
        manageEmployees: true,
        manageLeaves: true,
        approveLeaves: true,
        viewReports: true,
        exportData: true,
        manageBackup: true,
        manageUsers: true
      });
      db.prepare(`INSERT INTO users (id, username, fullName, password, role, permissions, mustChangePassword, active)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'admin_root', 'admin', 'المدير العام', hash, 'system_admin', adminPerms, 1, 1
      );
    }
  } catch (err) {
    console.error("Database init error:", err);
  }
}

// معالج تسجيل الدخول
ipcMain.handle('auth-login', async (event, { username, password }) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username);
    if (!user) return { success: false, error: "USER_NOT_FOUND" };

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return { success: false, error: "WRONG_PASSWORD" };

    const { password: _, ...safeUser } = user;

    // حماية من JSON فارغ أو غير صالح
    safeUser.permissions = {};
    try {
      safeUser.permissions = user.permissions ? JSON.parse(user.permissions) : {};
    } catch {
      safeUser.permissions = {};
    }

    return { success: true, user: safeUser };
  } catch (err) {
    console.error("Login error:", err);
    return { success: false, error: "SERVER_ERROR" };
  }
});

// إنشاء نافذة التطبيق
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev
    },
    title: "نظام إدارة الإجازات الاحترافي",
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true
  });

  Menu.setApplicationMenu(null);

  // تحميل ملف index.html مع دعم EXE و التطوير
  let indexPath;
  if (isDev) {
    indexPath = path.join(__dirname, 'dist', 'index.html'); // التطوير
  } else {
    indexPath = path.join(process.resourcesPath, 'app', 'dist', 'index.html'); // EXE
  }

  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
}

// تشغيل التطبيق
app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
