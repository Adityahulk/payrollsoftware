import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import Loader from './components/Loader';
import GlobalLoader from './components/GlobalLoader';
import BackgroundMonitor from './components/BackgroundMonitor';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const SalaryPage = lazy(() => import('./pages/SalaryPage'));
const QueriesPage = lazy(() => import('./pages/QueriesPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const WorkLogsPage = lazy(() => import('./pages/WorkLogsPage'));
const SpacesPage = lazy(() => import('./pages/SpacesPage'));
const AllEmployeesPage = lazy(() => import('./pages/AllEmployeesPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));
const LeavePage = lazy(() => import('./pages/LeavePage'));
const ManageUsersPage = lazy(() => import('./pages/ManageUsersPage'));
const LiveMonitoringPage = lazy(() => import('./pages/LiveMonitoringPage'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const PayslipSettingsPage = lazy(() => import('./pages/PayslipSettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false, // Prevent unnecessary refetch on Alt-Tab
    },
  },
});

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #E5E7EB',
        borderTopColor: '#4F46E5', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>Loading...</span>
    </div>
  );
}

export default function App() {
  // Removed artificial 1-second setTimeout delay — saves 1s on every page load

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <BackgroundMonitor />
          <ErrorBoundary>
            <OfflineBanner />
            <GlobalLoader />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 8000,
                style: {
                  borderRadius: '10px',
                  background: '#1F2937',
                  color: '#F9FAFB',
                  fontSize: '13px',
                  fontWeight: '500',
                  padding: '12px 16px',
                  boxShadow: '0 10px 32px rgba(0,0,0,0.2)',
                },
                success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
                error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
              }}
            />

            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* SuperAdmin routes */}
                <Route path="/superadmin" element={
                  <ProtectedRoute allowedRoles={['SuperAdmin']}>
                    <SuperAdminDashboard />
                  </ProtectedRoute>
                } />

                {/* Admin-only routes */}
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/admin/users" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <UsersPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/projects" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <ProjectsPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/attendance" element={
                  <ProtectedRoute allowedRoles={['Admin', 'TeamLead', 'Manager']}>
                    <AttendancePage isAdmin={true} />
                  </ProtectedRoute>
                } />
                <Route path="/admin/salary" element={
                  <ProtectedRoute allowedRoles={['Admin', 'TeamLead', 'Manager']}>
                    <SalaryPage isAdmin={true} />
                  </ProtectedRoute>
                } />
                <Route path="/admin/queries" element={
                  <ProtectedRoute allowedRoles={['Admin', 'TeamLead', 'Manager']}>
                    <QueriesPage isAdmin={true} />
                  </ProtectedRoute>
                } />
                <Route path="/admin/spaces" element={
                  <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                    <SpacesPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/leaves" element={
                  <ProtectedRoute allowedRoles={['Admin', 'Manager', 'TeamLead']}>
                    <LeavePage isAdmin={true} />
                  </ProtectedRoute>
                } />
                <Route path="/payroll/:spaceId" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <PayrollPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/live-monitoring" element={
                  <ProtectedRoute allowedRoles={['Admin', 'Manager', 'TeamLead']}>
                    <LiveMonitoringPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/settings/payslip" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <PayslipSettingsPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/profile" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/profile/:empId" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/progress" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <ProgressPage isAdmin={true} />
                  </ProtectedRoute>
                } />

                {/* Redirects for legacy TL/Manager routes */}
                <Route path="/teamlead" element={<Navigate to="/employee" replace />} />
                <Route path="/teamlead/*" element={<Navigate to="/employee" replace />} />
                <Route path="/manager" element={<Navigate to="/employee" replace />} />
                <Route path="/manager/*" element={<Navigate to="/employee" replace />} />

                {/* Employee routes — accessible by Employee, TeamLead, Manager */}
                <Route path="/employee" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <EmployeeDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/employee/attendance" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <AttendancePage isAdmin={false} />
                  </ProtectedRoute>
                } />
                <Route path="/employee/salary" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <SalaryPage isAdmin={false} />
                  </ProtectedRoute>
                } />
                <Route path="/employee/queries" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <QueriesPage isAdmin={false} />
                  </ProtectedRoute>
                } />
                <Route path="/employee/worklogs" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <WorkLogsPage />
                  </ProtectedRoute>
                } />
                <Route path="/employee/manage-users" element={
                  <ProtectedRoute allowedRoles={['Manager']}>
                    <ManageUsersPage />
                  </ProtectedRoute>
                } />
                <Route path="/employee/all-employees" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <AllEmployeesPage />
                  </ProtectedRoute>
                } />
                <Route path="/employee/progress" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <ProgressPage />
                  </ProtectedRoute>
                } />
                <Route path="/employee/projects" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <ProjectsPage />
                  </ProtectedRoute>
                } />
                <Route path="/employee/profile" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/employee/leaves" element={
                  <ProtectedRoute allowedRoles={['Employee', 'TeamLead', 'Manager']}>
                    <LeavePage isAdmin={false} />
                  </ProtectedRoute>
                } />

                {/* Redirects */}
                <Route path="/" element={<LandingPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
