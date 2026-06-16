import apiClient, { withRetry } from './client';

export const payrollApi = {
  // GET /api/Salary/me?month=5&year=2026
  getMySalary: (month, year, signal) =>
    withRetry(() => apiClient.get('/Salary/me', { params: { month, year }, signal })),

  // GET /api/Salary/{empId}?month=&year=  (admin)
  getSalaryByEmpId: (empId, month, year, signal) =>
    withRetry(() => apiClient.get(`/Salary/${empId}`, { params: { month, year }, signal })),

  // GET /api/Salary/progress  (current user progress report)
  getMyProgress: (signal) =>
    withRetry(() => apiClient.get('/Salary/progress', { signal })),

  // GET /api/Salary/progress/{empId}  (admin)
  getProgressByEmpId: (empId, signal) =>
    withRetry(() => apiClient.get(`/Salary/progress/${empId}`, { signal })),

  // GET /api/payroll/history — real payment records from t_payrollpayments
  getPaymentHistory: (signal) =>
    withRetry(() => apiClient.get('/payroll/history', { signal })),

  // GET /api/payroll/ctc-summary?year= — backend-calculated annual CTC
  getCtcSummary: (year, signal) =>
    withRetry(() => apiClient.get('/payroll/ctc-summary', { params: { year }, signal })),

  // GET /api/payroll/impact — payroll penalty impact
  getPayrollImpact: (signal) =>
    withRetry(() => apiClient.get('/payroll/impact', { signal })),

  // GET /api/analytics/productivity — productivity score breakdown
  getProductivity: (signal) =>
    withRetry(() => apiClient.get('/analytics/productivity', { signal })),

  // GET /api/performance — performance grade (A+/A/B/C/D)
  getPerformance: (signal) =>
    withRetry(() => apiClient.get('/performance', { signal })),

  // GET /api/payroll/myslips — employee's own payslips with admin-configured breakdown
  getMyPayslips: (signal) =>
    withRetry(() => apiClient.get('/payroll/myslips', { signal })),

  // GET /api/payroll/full/{empId} — (admin/manager) consolidated payroll structure, history, and work impact stats
  getFullPayrollDetails: (empId, month, year, signal) =>
    withRetry(() => apiClient.get(`/payroll/full/${empId}`, { params: { month, year }, signal })),

  // POST /api/payroll/process-month — (admin) bulk process monthly payouts and payslips
  processMonthPayroll: (month, year) =>
    apiClient.post('/payroll/process-month', { month, year }),

  // GET /api/payroll/salary-slip/{empId}?month=&year= — structured salary slip with full breakdown
  getSalarySlip: (empId, month, year, signal) =>
    withRetry(() => apiClient.get(`/payroll/salary-slip/${empId}`, { params: { month, year }, signal })),

  // GET /api/payroll/export-excel?spaceId=&month=&year= — download dual-sheet Excel
  exportPayrollExcel: (spaceId, month, year) =>
    apiClient.get('/payroll/export-excel', {
      params: { spaceId, month, year },
      responseType: 'blob',
    }),
};
