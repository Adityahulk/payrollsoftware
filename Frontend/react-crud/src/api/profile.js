import apiClient, { withRetry } from './client';
import { BACKEND_ORIGIN } from '../config';

export const profileApi = {
  // GET /api/Profile/me
  getMyProfile: (signal) =>
    withRetry(() => apiClient.get('/Profile/me', { signal })),

  // GET /api/Profile/{empId}  (admin/TL/manager)
  getProfileByEmpId: (empId, signal) =>
    withRetry(() => apiClient.get(`/Profile/${empId}`, { signal })),

  // PUT /api/Profile/update/{empId?}
  updateProfile: (data, empId = null) => {
    const url = empId ? `/Profile/update/${empId}` : '/Profile/update';
    return apiClient.put(url, data);
  },

  // POST /api/Profile/photo — multipart
  uploadPhoto: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post('/Profile/photo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // POST /api/Profile/documents — multipart arrays
  uploadDocuments: (rows) => {
    const fd = new FormData();
    rows.forEach((row, i) => {
      fd.append('documentTypes', row.type);
      fd.append('documentNumbers', row.number);
      fd.append('files', row.file);
    });
    return apiClient.post('/Profile/documents', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // GET /api/Profile/documents
  getMyDocuments: (signal) =>
    withRetry(() => apiClient.get('/Profile/documents', { signal })),

  // DELETE /api/Profile/documents/{docId}
  deleteDocument: (docId) =>
    apiClient.delete(`/Profile/documents/${docId}`),

  // POST /api/Profile/update-backup-email
  updateBackupEmail: (backupEmail) =>
    apiClient.post('/Profile/update-backup-email', { backupEmail }),

  // POST /api/Profile/change-password
  changePassword: (oldPassword, newPassword) =>
    apiClient.post('/Profile/change-password', { oldPassword, newPassword }),

  // Build absolute URL for serving static files
  getFileUrl: (relativePath) => {
    if (!relativePath) return null;
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;
    // Ensure relativePath starts with /
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    return `${BACKEND_ORIGIN}${path}`;
  },
};
