import apiClient from './client';

export const analyticsApi = {
  getProductivity: () => apiClient.get('/analytics/productivity'),
  getPayrollImpact: () => apiClient.get('/payroll/impact'),
  getPerformanceGrade: () => apiClient.get('/performance'),
};
