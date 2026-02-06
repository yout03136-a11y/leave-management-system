
import React, { useState, useEffect, useMemo } from 'react';
import { User, Employee, Department, LeaveRequest, Notification } from './types';
import { INITIAL_DEPARTMENTS } from './constants';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import EmployeesList from './components/EmployeesList';
import DepartmentsList from './components/DepartmentsList';
import LeavesList from './components/LeavesList';
import Reports from './components/Reports';
import Backup from './components/Backup';
import UsersManagement from './components/UsersManagement';
import About from './components/About';

const createDbProvider = () => {
  const isElectron = !!(window as any).electronAPI;

  if (isElectron) {
    return (window as any).electronAPI.db;
  }

  // Fallback for browser (development)
  return {
    getAll: async (table: string) => {
      const data = localStorage.getItem(`db_${table}`);
      return data ? JSON.parse(data) : [];
    },
    bulkSave: async (table: string, items: any[]) => {
      localStorage.setItem(`db_${table}`, JSON.stringify(items));
      return true;
    }
  };
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [activePage, setActivePage] = useState('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const db = useMemo(() => createDbProvider(), []);

  const showToast = (message: string, type: Notification['type'] = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dbEmps, dbDepts, dbLeaves, dbUsers] = await Promise.all([
          db.getAll('employees'),
          db.getAll('departments'),
          db.getAll('leaves'),
          db.getAll('users')
        ]);

        setEmployees(dbEmps || []);
        setDepartments(dbDepts.length > 0 ? dbDepts : INITIAL_DEPARTMENTS);
        setLeaves(dbLeaves || []);
        
        const parsedUsers = dbUsers.map((u: any) => ({
          ...u,
          permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions
        }));
        setSystemUsers(parsedUsers);

        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);
          if (user.mustChangePassword) setShowPasswordChange(true);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Database initialization failed:", error);
        setIsLoading(false);
        showToast('خطأ في الاتصال بقاعدة البيانات المحلية', 'danger');
      }
    };

    loadData();
  }, [db]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (user.mustChangePassword) setShowPasswordChange(true);
    showToast(`أهلاً بك، ${user.fullName}`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const handlePasswordUpdate = async (pass: string) => {
    if (!currentUser) return;
    try {
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.db.updatePassword(currentUser.id, pass);
      }
      setShowPasswordChange(false);
      const updatedUser = { ...currentUser, mustChangePassword: 0 };
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      showToast('تم تحديث كلمة المرور بنجاح');
    } catch (e) {
      showToast('فشل تحديث كلمة المرور', 'danger');
    }
  };

  const renderContent = () => {
    if (!currentUser) return null;
    
    const commonProps = {
      currentUser,
      showToast,
      employees,
      departments,
      leaves,
      setEmployees: async (val: any) => {
        const next = typeof val === 'function' ? val(employees) : val;
        setEmployees(next);
        await db.bulkSave('employees', next);
      },
      setDepartments: async (val: any) => {
        const next = typeof val === 'function' ? val(departments) : val;
        setDepartments(next);
        await db.bulkSave('departments', next);
      },
      setLeaves: async (val: any) => {
        const next = typeof val === 'function' ? val(leaves) : val;
        setLeaves(next);
        await db.bulkSave('leaves', next);
      }
    };

    switch (activePage) {
      case 'dashboard': return <Dashboard employees={employees} leaves={leaves} departments={departments} />;
      case 'employees': return <EmployeesList {...commonProps} setDepartments={commonProps.setDepartments} />;
      case 'departments': return <DepartmentsList {...commonProps} setDepartments={commonProps.setDepartments} />;
      case 'leaves': return <LeavesList {...commonProps} setLeaves={commonProps.setLeaves} />;
      case 'reports': return <Reports {...commonProps} />;
      case 'users': return <UsersManagement {...commonProps} systemUsers={systemUsers} setSystemUsers={async (val: any) => {
        const next = typeof val === 'function' ? val(systemUsers) : val;
        setSystemUsers(next);
        await db.bulkSave('users', next);
      }} />;
      case 'backup': return <Backup {...commonProps} setEmployees={commonProps.setEmployees} setLeaves={commonProps.setLeaves} setDepartments={commonProps.setDepartments} />;
      case 'about': return <About />;
      default: return <Dashboard employees={employees} leaves={leaves} departments={departments} />;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white font-['Cairo']">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black">جاري تحميل قاعدة البيانات...</h2>
      </div>
    );
  }

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-['Cairo'] text-right selection:bg-indigo-100 selection:text-indigo-900" dir="rtl">
      <Sidebar activePage={activePage} onNavigate={setActivePage} currentUser={currentUser} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header currentUser={currentUser} onLogout={handleLogout} pageTitle={activePage} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderContent()}
          </div>
          
          <div className="fixed bottom-8 left-8 z-[100] flex flex-col gap-3 pointer-events-none">
            {notifications.map(n => (
              <div key={n.id} className={`px-6 py-4 rounded-2xl shadow-2xl text-white font-bold flex items-center gap-3 animate-in slide-in-from-left-5 fade-in duration-300 pointer-events-auto border-b-4 ${
                n.type === 'success' ? 'bg-emerald-600 border-emerald-800' : 
                n.type === 'danger' ? 'bg-rose-600 border-rose-800' : 
                'bg-indigo-600 border-indigo-800'
              }`}>
                {n.message}
              </div>
            ))}
          </div>
        </main>
      </div>

      {showPasswordChange && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
             <div className="text-center mb-8">
                <div className="bg-amber-100 w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-amber-600">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-800">تحديث كلمة المرور</h3>
                <p className="text-slate-500 font-bold text-sm mt-2">يجب تغيير كلمة المرور الافتراضية عند أول دخول</p>
             </div>
             <form onSubmit={(e) => {
               e.preventDefault();
               const val = (e.currentTarget.elements.namedItem('newPass') as HTMLInputElement).value;
               if (val.length < 6) return showToast('كلمة المرور قصيرة جداً', 'danger');
               handlePasswordUpdate(val);
             }} className="space-y-6">
                <input name="newPass" type="password" required placeholder="كلمة المرور الجديدة" className="w-full px-6 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-100 font-bold" />
                <button type="submit" className="btn-base btn-primary w-full py-4 text-xl">تحديث ودخول</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
