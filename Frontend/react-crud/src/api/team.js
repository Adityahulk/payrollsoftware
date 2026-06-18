import apiClient, { withRetry } from './client';

export const teamApi = {
  // GET /api/User/team — all employees under same Admin (for TL/Manager task assignment)
  getTeamMembers: (signal) =>
    withRetry(() => apiClient.get('/User/team', { signal })),
};
