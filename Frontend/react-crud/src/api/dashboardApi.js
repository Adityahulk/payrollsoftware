import apiClient, { withRetry } from './client';

export const dashboardApi = {
  getRecentWorklogs: (days, signal) =>
    withRetry(() => apiClient.get('/dashboard/recent-worklogs', { params: { days }, signal })),

  getRecentEmployees: (days, signal) =>
    withRetry(() => apiClient.get('/dashboard/recent-employees', { params: { days }, signal })),

  // New: single call returning all admin summary metrics (replaces 5+ separate calls)
  getAdminSummary: (signal) =>
    withRetry(() => apiClient.get('/dashboard/admin-summary', { signal })),
};
