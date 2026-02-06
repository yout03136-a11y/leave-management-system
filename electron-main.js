
const { app, BrowserWindow, screen, Menu, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const isDev = process.env.NODE_ENV === 'development';

const ALLOWED_TABLES = ['employees', 'departments', 'leaves', 'users', 'logs'];

// مسار قاعدة البيانات في مجلد بيانات المستخدم لضمان الاستمرارية
const dbPath = path.join(app.getPath('userData'), 'leave_system_pro_v2.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    // جدول الموظفين
    db.run(`CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY, 
      name TEXT, 
      departmentId TEXT, 
      position TEXT, 
      hireDate TEXT, 
      leaveBalance REAL
    )`);
    
    // جدول الأقسام
    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY, 
      name TEXT, 
      code TEXT, 
      description TEXT, 
      managerName TEXT
    )`);
    
    // جدول الإجازات
    db.run(`CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY, 
      employeeId TEXT, 
      employeeName TEXT, 
      type TEXT, 
      startDate TEXT, 
      endDate TEXT, 
      days REAL, 
      reason TEXT, 
      status TEXT, 
      requestDate TEXT
    )`);
    
    // جدول المستخدمين مع دعم حقل تغيير كلمة المرور
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, 
      username TEXT UNIQUE, 
      fullName TEXT, 
      password TEXT, 
      role TEXT, 
      permissions TEXT, 
      mustChangePassword INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1
    )`);

    // إنشاء حساب المدير الافتراضي إذا لم يكن موجوداً
    db.get("SELECT COUNT(*) as count FROM users WHERE username = 'admin'", (err, row) => {
      if (row && row.count === 0) {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin123', salt);
        
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

        db.run(`INSERT INTO users (id, username, fullName, password, role, permissions, mustChangePassword, active) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                ['admin_root', 'admin', 'المدير العام', hash, 'system_admin', adminPerms, 1, 1]);
      }
    });
  });
}

// معالجات IPC لقاعدة البيانات
ipcMain.handle('db-get-all', async (event, table) => {
  if (!ALLOWED_TABLES.includes(table)) throw new Error('Unauthorized access');
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
});

ipcMain.handle('auth-login', async (event, { username, password }) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE username = ? AND active = 1", [username], (err, user) => {
      if (err) return reject(err);
      if (!user) return resolve(null);
      
      const isValid = bcrypt.compareSync(password, user.password);
      if (isValid) {
        const { password: _, ...safeUser } = user;
        // إرجاع الصلاحيات ككائن جاهز للـ React
        safeUser.permissions = JSON.parse(user.permissions);
        resolve(safeUser);
      } else {
        resolve(null);
      }
    });
  });
});

ipcMain.handle('db-bulk-save', async (event, { table, items }) => {
  if (!ALLOWED_TABLES.includes(table)) return false;
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run(`DELETE FROM ${table}`); // مسح القديم للمزامنة الكاملة
      
      if (items && items.length > 0) {
        const keys = Object.keys(items[0]);
        const placeholders = keys.map(() => '?').join(',');
        const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`);
        
        items.forEach(item => {
          const vals = Object.values(item).map(v => 
            (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v
          );
          stmt.run(vals);
        });
        stmt.finalize();
      }

      db.run("COMMIT", (err) => {
        if (err) reject(err); else resolve(true);
      });
    });
  });
});

ipcMain.handle('update-password', async (event, { userId, newPassword }) => {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(newPassword, salt);
  return new Promise((resolve, reject) => {
    db.run("UPDATE users SET password = ?, mustChangePassword = 0 WHERE id = ?", [hash, userId], function(err) {
      if (err) reject(err); else resolve(true);
    });
  });
});

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev // إخفاء DevTools في نسخة EXE
    },
    title: "نظام إدارة الإجازات الاحترافي",
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
