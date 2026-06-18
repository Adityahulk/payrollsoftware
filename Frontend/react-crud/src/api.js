import { authApi } from './api/index';
import { attendanceApi as oldAttendanceApi } from './api/attendance';

// Backwards-compat re-exports — all API calls now live in src/api/
export { authApi as default } from './api/index';
export { attendanceApi } from './api/attendance';
export { projectsApi } from './api/projects';
export { payrollApi } from './api/payroll';
export { usersApi, spacesApi, noticesApi, authApi, notificationsApi, monitorApi, wfhApi } from './api/index';

// Legacy named exports for any files not yet migrated
export const login    = (email, pw) => authApi.login(email, pw);
export const register = (data)      => authApi.register(data);
export const clockIn  = ()          => oldAttendanceApi.clockIn();
export const clockOut = ()          => oldAttendanceApi.clockOut();
export const getMyAttendance  = ()  => oldAttendanceApi.getMyAttendance();
export const getAllAttendance  = ()  => oldAttendanceApi.getAllAttendance();
