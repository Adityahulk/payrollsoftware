import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { usersApi } from '../api/index';
import { attendanceApi } from '../api/attendance';
import { useAuth } from '../AuthContext';
import { DashboardStatsSkeleton } from '../components/Skeletons';

function MetricCard({ icon, iconBg, iconColor, label, value, badge, badgeClass }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-card-icon" style={{ background: iconBg }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: iconColor }}>{icon}</span>
        </div>
        {badge && <span className={`badge ${badgeClass}`}>{badge}</span>}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-900)' }}>{value}</div>
      </div>
    </div>
  );
}

export default function TLDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatUserData = (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(u => ({
      ...u,
      name: u.name || (u.email ? u.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown')
    }));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      usersApi.getUsers().then(r => setUsers(formatUserData(r.data || []))).catch(() => setUsers([])),
      attendanceApi.getAllAttendance().then(r => setAttendance(Array.isArray(r.data) ? r.data : [])).catch(() => setAttendance([])),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeUsers = users.filter(u => (u.status || '').toLowerCase() === 'active');
  const presentToday = attendance.filter(a => {
    if (!a.clockIn) return false;
    return new Date(a.clockIn).toDateString() === new Date().toDateString();
  }).length;

  const ROLE_BADGE = { Admin: 'badge-error', TeamLead: 'badge-warning', Employee: 'badge-primary', Manager: 'badge-success' };

  return (
    <AppLayout role="admin">
      <div className="page-content fade-in">
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Team Lead Dashboard</h1>
          <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
            Welcome back, {user?.name?.split(' ')[0] || 'Team Lead'}.
            Space ID: <strong style={{color: 'var(--primary-600)', background: 'var(--primary-50)', padding: '2px 6px', borderRadius: 4}}>#{user?.spaceId}</strong>
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--gray-400)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>visibility</span> Read-only access
            </span>
          </p>
        </div>

        {/* Metrics */}
        {loading ? <DashboardStatsSkeleton /> : (
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            <MetricCard icon="group" iconBg="#EEF2FF" iconColor="#4F46E5" label="Total Team Members" value={users.length} badge={`${activeUsers.length} active`} badgeClass="badge-success" />
            <MetricCard icon="event_available" iconBg="#D1FAE5" iconColor="#059669" label="Present Today" value={presentToday} />
            <MetricCard icon="person" iconBg="#FEF3C7" iconColor="#D97706" label="Employees" value={users.filter(u => u.role === 'Employee').length} />
            <MetricCard icon="manage_accounts" iconBg="#FEE2E2" iconColor="#DC2626" label="Managers" value={users.filter(u => u.role === 'Manager').length} />
          </div>
        )}

        {/* Team listing (read-only) */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Company Employees</h2>
            <span className="badge badge-warning" style={{ fontSize: 11 }}>Read Only</span>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Role</th><th>Space</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="skeleton animate-pulse" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-200)' }} />
                          <div>
                            <div className="skeleton animate-pulse" style={{ width: 120, height: 14, background: 'var(--gray-200)', borderRadius: 4, marginBottom: 4 }} />
                            <div className="skeleton animate-pulse" style={{ width: 160, height: 11, background: 'var(--gray-200)', borderRadius: 4 }} />
                          </div>
                        </div>
                      </td>
                      <td><div className="skeleton animate-pulse" style={{ width: 60, height: 18, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 40, height: 14, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 50, height: 18, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>No employees available in this space 🚫</td></tr>
                ) : users.slice(0, 10).map((emp, i) => (
                  <tr key={emp.empId || i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar">{(emp.name || emp.email || 'U')[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name || emp.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${ROLE_BADGE[emp.role] || 'badge-gray'}`}>{emp.role}</span></td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--gray-500)' }}>#{emp.spaceId}</td>
                    <td>
                      <span className={`badge ${(emp.status || '').toLowerCase() === 'active' ? 'badge-success' : (emp.status || '').toLowerCase() === 'pending' ? 'badge-warning' : 'badge-error'}`}>
                        {emp.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
