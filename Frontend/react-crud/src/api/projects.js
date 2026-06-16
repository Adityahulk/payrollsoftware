import apiClient, { withRetry } from './client';

export const projectsApi = {
  // All projects (admin sees company projects; manager sees all; employee sees assigned; TL sees created)
  getProjects: (signal) =>
    withRetry(() => apiClient.get('/Project', { signal })),

  // Projects created by logged-in TeamLead
  getMyProjects: (signal) =>
    withRetry(() => apiClient.get('/Project/my', { signal })),

  createProject: (data) =>
    apiClient.post('/Project', data),

  // Create project + tasks in one API call
  createProjectWithTasks: (data) =>
    apiClient.post('/Project/create-with-tasks', data),

  updateProject: (id, data) =>
    apiClient.put(`/Project/${id}`, data),

  deleteProject: (id) =>
    apiClient.delete(`/Project/${id}`),

  // Get all tasks for a project
  getTasks: (projectId, signal) =>
    withRetry(() => apiClient.get(`/Project/${projectId}/tasks`, { signal })),

  // Assign/create a task
  assignTask: (data) =>
    apiClient.post('/Project/tasks', data),

  // Update a task (full)
  updateTask: (taskId, data) =>
    apiClient.put(`/Project/tasks/${taskId}`, data),

  // Update task status only
  updateTaskStatus: (taskId, status) =>
    apiClient.patch(`/Project/tasks/${taskId}/status`, { status }),

  // Tasks assigned to logged-in employee
  getMyTasks: (signal) =>
    withRetry(() => apiClient.get('/Project/my-tasks', { signal })),

  // All tasks from TL's projects (with optional search)
  getAllAssignedTasks: (search, signal) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return withRetry(() => apiClient.get(`/Project/all-assigned-tasks${params}`, { signal }));
  },

  // Tasks assigned to a specific employee (admin/TL use)
  getEmployeeTasks: (empId, signal) =>
    withRetry(() => apiClient.get(`/Project/employee/${empId}/tasks`, { signal })),

  logWork: (data) =>
    apiClient.post('/Worklog', data),

  getWorkLogs: (signal) =>
    withRetry(() => apiClient.get('/Worklog', { signal })),
};
