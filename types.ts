
export type LeaveStatus = 'قيد المراجعة' | 'موافق عليها' | 'مرفوضة';
export type UserRole = 'system_admin' | 'dept_manager' | 'supervisor' | 'employee';

export interface UserPermissions {
  viewDashboard: boolean;
  manageEmployees: boolean;
  manageLeaves: boolean;
  approveLeaves: boolean;
  viewReports: boolean;
  exportData: boolean;
  manageBackup: boolean;
  manageUsers: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  password?: string;
  email?: string;
  role: UserRole;
  permissions: UserPermissions;
  active: boolean;
  // Added mustChangePassword to support force-change password feature on first login
  mustChangePassword?: number;
  createdAt?: string;
}

export interface Employee {
  id: string;
  name: string;
  departmentId: string;
  position: string;
  hireDate: string;
  leaveBalance: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  managerName?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  requestDate: string;
  reviewedAt?: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'danger';
}
