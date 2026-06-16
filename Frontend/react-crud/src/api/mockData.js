// ─── Mock data for development / offline use ────────────────────────────────

export const MOCK_USERS = [
  { empId: 1, name: 'John Doe', email: 'john@payflow.com', role: 'Admin', spaceId: 1, status: 'active' },
  { empId: 2, name: 'Sarah Chen', email: 'sarah@payflow.com', role: 'TeamLead', spaceId: 1, status: 'active' },
  { empId: 3, name: 'Raj Patel', email: 'raj@payflow.com', role: 'Employee', spaceId: 1, status: 'active' },
  { empId: 4, name: 'Emma Wilson', email: 'emma@payflow.com', role: 'Employee', spaceId: 2, status: 'active' },
  { empId: 5, name: 'Arjun Sharma', email: 'arjun@payflow.com', role: 'Employee', spaceId: 1, status: 'inactive' },
];

export const MOCK_PROJECTS = [
  {
    id: 1, name: 'Project Alpha', description: 'Frontend modernisation initiative',
    link: 'https://github.com/org/alpha', spaceId: 1,
    modules: ['Frontend', 'API Integration', 'Testing'],
  },
  {
    id: 2, name: 'Project Beta', description: 'Backend microservices migration',
    link: 'https://github.com/org/beta', spaceId: 1,
    modules: ['Auth Service', 'Payroll Engine', 'Notifications'],
  },
  {
    id: 3, name: 'HR Portal', description: 'Internal HR management tool',
    link: 'https://github.com/org/hrportal', spaceId: 2,
    modules: ['Dashboard', 'Reports', 'Employee Onboarding'],
  },
];

export const MOCK_WORK_LOGS = [
  { id: 1, date: '2026-05-15', project: 'Project Alpha', module: 'Frontend', hours: 6, description: 'Implemented clock-in UI with optimistic updates', status: 'submitted' },
  { id: 2, date: '2026-05-14', project: 'Project Alpha', module: 'API Integration', hours: 4, description: 'Integrated TanStack Query for attendance data', status: 'approved' },
  { id: 3, date: '2026-05-13', project: 'Project Beta', module: 'Auth Service', hours: 8, description: 'Refactored JWT middleware and refresh logic', status: 'approved' },
  { id: 4, date: '2026-05-12', project: 'HR Portal', module: 'Dashboard', hours: 5, description: 'Built skeleton loader components', status: 'pending' },
  { id: 5, date: '2026-05-09', project: 'Project Beta', module: 'Payroll Engine', hours: 7, description: 'CTC calculation engine with tax slabs', status: 'approved' },
];

export const MOCK_ATTENDANCE = [
  { id: 1, date: '2026-05-16', clockIn: '2026-05-16T09:02:00', clockOut: null, breakDuration: 0, status: 'Present' },
  { id: 2, date: '2026-05-15', clockIn: '2026-05-15T09:15:00', clockOut: '2026-05-15T18:10:00', breakDuration: 45, status: 'Present' },
  { id: 3, date: '2026-05-14', clockIn: '2026-05-14T10:05:00', clockOut: '2026-05-14T18:30:00', breakDuration: 60, status: 'Late' },
  { id: 4, date: '2026-05-13', clockIn: null, clockOut: null, breakDuration: 0, status: 'Absent' },
  { id: 5, date: '2026-05-12', clockIn: '2026-05-12T09:00:00', clockOut: '2026-05-12T17:45:00', breakDuration: 30, status: 'Present' },
];

export const MOCK_SALARY = {
  month: 5, year: 2026,
  basic: 25000, hra: 10000, da: 3000,
  totalEarnings: 38000,
  pf: 1800, tax: 2000,
  totalDeductions: 3800,
  netPay: 34200,
};

export const MOCK_NOTICES = [
  { id: 1, title: 'Office Holiday', description: 'Office will be closed on May 19th for Buddha Purnima.', createdBy: 'Admin', target: 'All', type: 'General', date: '2026-05-10', isResolved: false },
  { id: 2, title: 'Payroll Processing', description: 'May salary will be credited by 30th May 2026.', createdBy: 'HR', target: 'All', type: 'General', date: '2026-05-08', isResolved: false },
  { id: 3, title: 'Late Arrival Warning', description: 'Please note that 3+ late arrivals will affect your attendance score.', createdBy: 'Manager', target: 'Employee', type: 'Warning', date: '2026-05-05', isResolved: true },
];

export const MOCK_QUERIES = [
  { id: 1, title: 'Salary discrepancy for April', description: 'My April salary seems to have incorrect HRA calculation.', sendTo: 'Admin', status: 'Open', date: '2026-05-12', replies: [] },
  { id: 2, title: 'Work from home policy', description: 'Could you clarify the WFH policy for this month?', sendTo: 'TeamLead', status: 'Resolved', date: '2026-05-01', replies: [{ author: 'Sarah Chen', text: 'WFH is allowed 2 days/week with prior approval.', date: '2026-05-02' }] },
];

export const MOCK_SPACES = [
  { id: 1, name: 'Engineering', employeeLimit: 50, currentCount: 12 },
  { id: 2, name: 'HR & Admin', employeeLimit: 20, currentCount: 5 },
  { id: 3, name: 'Sales', employeeLimit: 30, currentCount: 18 },
];
