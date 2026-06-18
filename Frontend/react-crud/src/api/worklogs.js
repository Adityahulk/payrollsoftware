import apiClient, { withRetry } from './client';

export const worklogsApi = {
  // POST a new worklog (taskId, hoursWorked, description)
  createWorklog: (data) =>
    apiClient.post('/Worklog', data),

  // GET my worklogs (JWT-scoped)
  getMyWorklogs: (signal) =>
    withRetry(() => apiClient.get('/Worklog', { signal })),

  // GET worklogs for specific emp (admin/TL only)
  getWorklogsByEmpId: (empId, signal) =>
    withRetry(() => apiClient.get(`/Worklog/${empId}`, { signal })),

  // GET my task progress (hours, completion %)
  getMyTaskProgress: (signal) =>
    withRetry(() => apiClient.get('/Worklog/tasks', { signal })),

  // GET task progress for specific emp
  getTaskProgressByEmpId: (empId, signal) =>
    withRetry(() => apiClient.get(`/Worklog/tasks/${empId}`, { signal })),

  // GET worklogs chart data
  getWorklogsChart: (range) =>
    apiClient.get('/worklogs/me', { params: { range } }),

  // GET my daily activity
  getMyDailyActivity: (range) =>
    apiClient.get('/worklogs/me/activity', { params: { range } }),

  // GET daily activity for specific emp
  getDailyActivityByEmpId: (empId, range) =>
    apiClient.get(`/worklogs/activity/${empId}`, { params: { range } }),
};
