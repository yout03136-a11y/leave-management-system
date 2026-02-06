
import { Department } from './types';

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: '1', name: 'الموارد البشرية', code: 'HR', description: 'إدارة الموارد البشرية', managerName: 'أحمد علي' },
  { id: '2', name: 'تقنية المعلومات', code: 'IT', description: 'تطوير البرمجيات والدعم', managerName: 'سارة محمد' },
  { id: '3', name: 'المالية', code: 'FIN', description: 'المحاسبة والشؤون المالية', managerName: 'خالد عبدالله' }
];

export const LEAVE_TYPES = ['سنوية', 'مرضية', 'طارئة', 'بدون راتب', 'حج', 'أخرى'];
