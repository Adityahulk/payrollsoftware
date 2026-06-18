import apiClient, { withRetry } from './client';

let clockIdempotencyKey = null;

function getClockKey(type) {
  if (!clockIdempotencyKey) {
    clockIdempotencyKey = `clock-${type}-${Date.now()}`;
  }
  return clockIdempotencyKey;
}

export function resetClockKey() {
  clockIdempotencyKey = null;
}

export const attendanceApi = {
  /** Returns { attendance: [...], dateOfJoining: "..." } */
  getMyAttendance: (signal) =>
    withRetry(() => apiClient.get('/Attendance/me', { signal })),

  getAllAttendance: (signal) =>
    withRetry(() => apiClient.get('/Attendance', { signal })),

  clockIn: () => {
    const key = getClockKey('in');
    return apiClient.post('/Attendance/clock-in', {}, {
      headers: { 'Idempotency-Key': key },
    }).finally(resetClockKey);
  },

  clockOut: () => {
    const key = getClockKey('out');
    return apiClient.post('/Attendance/clock-out', {}, {
      headers: { 'Idempotency-Key': key },
    }).finally(resetClockKey);
  },

  breakStart: () =>
    apiClient.post('/Attendance/break-start', {}),

  breakEnd: () =>
    apiClient.post('/Attendance/break-end', {}),

  getActiveBreak: () =>
    apiClient.get('/Attendance/active-break'),

  getTrends: () =>
    apiClient.get('/Attendance/trends'),

  getUserAttendance: (empId, signal) =>
    withRetry(() => apiClient.get(`/Attendance/user/${empId}`, { signal })),

  getHolidays: (signal) =>
    withRetry(() => apiClient.get('/Attendance/holidays', { signal })),

  addHoliday: (data) =>
    apiClient.post('/Attendance/holidays', data),

  deleteHoliday: (holidayId) =>
    apiClient.delete(`/Attendance/holidays/${holidayId}`),
};
