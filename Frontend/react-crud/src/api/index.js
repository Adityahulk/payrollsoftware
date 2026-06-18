import apiClient, { withRetry } from './client';

export const usersApi = {
  getUsers: (signal) =>
    withRetry(() => apiClient.get('/User', { signal })),

  // Employee-accessible endpoint: read-only company users
  getCompanyUsers: (signal) =>
    withRetry(() => apiClient.get('/User/company', { signal })),

  getUserById: (id, signal) =>
    withRetry(() => apiClient.get(`/User/${id}`, { signal })),

  searchUsers: (query, signal) =>
    withRetry(() => apiClient.get('/User/search', { params: { query: query }, signal })),

  createUser: (data) =>
    apiClient.post('/User', data),

  updateUser: (id, data) =>
    apiClient.put(`/User/${id}`, data),

  issueWarning: (empId, reason) =>
    apiClient.post(`/User/${empId}/warnings`, { warningText: reason, penaltyAmount: 0 }),

  updateStatus: (id, status, reason) =>
    apiClient.put(`/User/${id}/status`, { empId: id, status, reason }),
};

export const spacesApi = {
  getSpaces: (signal) =>
    withRetry(() => apiClient.get('/spaces', { signal })),

  getMySpaces: (signal) =>
    withRetry(() => apiClient.get('/spaces/my', { signal })),

  getSpacesByAdmin: (adminId, signal) =>
    withRetry(() => apiClient.get(`/spaces/admin/${adminId}`, { signal })),

  getContractsByAdmin: (adminId, signal) =>
    withRetry(() => apiClient.get(`/spaces/admin/${adminId}/contracts`, { signal })),

  getDepartmentsByAdmin: (adminId, signal) =>
    withRetry(() => apiClient.get(`/spaces/admin/${adminId}/departments`, { signal })),

  getEmployeesBySpace: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/spaces/${spaceId}/employees`, { signal })),

  getAllEmployeesByAdmin: (adminId, signal) =>
    withRetry(() => apiClient.get(`/spaces/admin/${adminId}/employees`, { signal })),

  createSpace: (data) =>
    apiClient.post('/spaces/create', data),

  updateSpace: (id, data) =>
    apiClient.put(`/spaces/update/${id}`, data),

  deleteSpace: (id) =>
    apiClient.delete(`/spaces/delete/${id}`),

  getContractPayment: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/spaces/contract/${spaceId}/payment`, { signal })),

  payContract: (spaceId, data) =>
    apiClient.post(`/spaces/contract/${spaceId}/pay`, data),

  getContractPayslips: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/spaces/contract/${spaceId}/payslips`, { signal })),

  getSpacePayroll: (spaceId, applyPenalties = true, month = null, year = null, signal) =>
    withRetry(() => apiClient.get(`/spaces/${spaceId}/payroll`, { params: { applyPenalties, month, year }, signal })),

  paySpacePayroll: (spaceId, data) =>
    apiClient.post(`/spaces/${spaceId}/payroll/pay`, data),

  confirmRazorpayPayment: (spaceId, data) =>
    apiClient.post(`/spaces/${spaceId}/payroll/confirm-payment`, data),

  createRazorpayOrder: (spaceId, data) =>
    apiClient.post(`/spaces/${spaceId}/payroll/razorpay/order`, data),

  // Reset all payroll payment status for a space (admin use — for reprocessing)
  resetSpacePayroll: (spaceId) =>
    apiClient.post(`/spaces/${spaceId}/payroll/reset`),

  // Fetch generated payslips for a space (post-payment records)
  getPayslipsBySpace: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/spaces/contract/${spaceId}/payslips`, { signal })),

  // Salary configurations
  setEmployeeSalary: (data) => apiClient.post('/spaces/salary', data),

  // Allowances
  getAllowances: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/spaces/${spaceId}/allowances`, { signal })),

  createAllowance: (spaceId, data) =>
    apiClient.post(`/spaces/${spaceId}/allowances`, data),

  deleteAllowance: (allowanceId) =>
    apiClient.delete(`/spaces/allowances/${allowanceId}`),

  // Deductions
  getDeductions: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/spaces/${spaceId}/deductions`, { signal })),

  createDeduction: (spaceId, data) =>
    apiClient.post(`/spaces/${spaceId}/deductions`, data),

  deleteDeduction: (deductionId) =>
    apiClient.delete(`/spaces/deductions/${deductionId}`),
};

export const noticesApi = {
  getNoticesBySpace: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/Notice/space/${spaceId}`, { signal })),

  getNoticesByEmployee: (empId, signal) =>
    withRetry(() => apiClient.get(`/Notice/employee/${empId}`, { signal })),

  createNotice: (data) =>
    apiClient.post('/Notice', data),

  deleteNotice: (id) =>
    apiClient.delete(`/Notice/${id}`),

  getQueries: (signal) =>
    withRetry(() => apiClient.get('/Notice/queries', { signal })),

  replyToQuery: (id, reply) =>
    apiClient.post(`/Notice/reply/${id}`, { reply }),

  updateQueryStatus: (id, status) =>
    apiClient.put(`/Notice/status/${id}`, { status }),

  deleteQuery: (id) =>
    apiClient.delete(`/Notice/query/${id}`),
};

export const notificationsApi = {
  getNotifications: (params, signal) =>
    withRetry(() => apiClient.get('/Notification', { params, signal })),

  markAsRead: (id, role) =>
    apiClient.put(`/Notification/mark-read/${id}`, null, { params: { role } }),
};

export const authApi = {
  login: (email, password) =>
    apiClient.post('/Auth/login', { email, password }),

  register: (data) =>
    apiClient.post('/Auth/register', data),

  forgotPassword: (email) =>
    apiClient.post('/Auth/forgot-password', { email }),

  verifyOtp: (email, otp) =>
    apiClient.post('/Auth/verify-otp', { email, otp }),

  resetPassword: (email, otp, newPassword) =>
    apiClient.post('/Auth/reset-password', { email, otp, newPassword }),
};

export const monitorApi = {
  getLatestScreenshots: (spaceId, signal) =>
    withRetry(() => apiClient.get(`/Monitor/space/${spaceId}/latest`, { signal })),

  uploadScreenshot: (formData) =>
    apiClient.post('/Monitor/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  uploadVideo: (formData) =>
    apiClient.post('/Monitor/upload-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  getEmployeeHistory: (empId, spaceId, signal) =>
    withRetry(() => apiClient.get(`/Monitor/employee-activity`, { params: { empid: empId, spaceid: spaceId }, signal })),

  /** Load per-space retention & capture settings */
  getMonitorConfig: (spaceId, empId = null, signal) => {
    const url = empId ? `/Monitor/config/${spaceId}?empId=${empId}` : `/Monitor/config/${spaceId}`;
    return withRetry(() => apiClient.get(url, { signal }));
  },

  /** Save per-space retention & capture settings */
  saveMonitorConfig: (spaceId, data, empId = null) => {
    const url = empId ? `/Monitor/config/${spaceId}?empId=${empId}` : `/Monitor/config/${spaceId}`;
    return apiClient.put(url, data);
  },
};

export const wfhApi = {
  grantWfh: (empId, date) =>
    apiClient.post('/Wfh/grant', { empId, date }),

  revokeWfh: (empId, date) =>
    apiClient.post('/Wfh/revoke', { empId, date }),

  getWfhPermissions: (signal) =>
    withRetry(() => apiClient.get('/Wfh/space', { signal })),
};

export * from './dashboardApi';

export const incentivesApi = {
  addIncentive: (data) =>
    apiClient.post('/incentives/add', data),

  getEmployeeIncentives: (empId, month, year, signal) =>
    withRetry(() => apiClient.get(`/incentives/employee/${empId}`, { params: { month, year }, signal })),

  deleteIncentive: (id) =>
    apiClient.delete(`/incentives/${id}`),
};

