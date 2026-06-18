import apiClient, { withRetry } from './client';

export const leavesApi = {
  applyLeave:    (data)             => apiClient.post('/Leave', data),
  getMyLeaves:   (signal)           => withRetry(() => apiClient.get('/Leave/me', { signal })),
  getLeaveBalance: (signal)         => withRetry(() => apiClient.get('/Leave/balance', { signal })),
  getAllLeaves:   (signal)           => withRetry(() => apiClient.get('/Leave', { signal })),
  updateStatus:  (leaveId, status)  => apiClient.patch(`/Leave/${leaveId}/status`, { status }),

  // Space leave policy (Admin/Manager)
  getLeaveConfig:    (spaceId, signal) => withRetry(() => apiClient.get(`/Leave/config/${spaceId}`, { signal })),
  updateLeaveConfig: (spaceId, data)   => apiClient.put(`/Leave/config/${spaceId}`, data),
};
