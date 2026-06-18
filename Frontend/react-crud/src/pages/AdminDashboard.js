import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { usersApi, noticesApi, spacesApi, dashboardApi } from '../api/index';
import { attendanceApi } from '../api/attendance';
import { useAuth } from '../AuthContext';
import { DashboardStatsSkeleton } from '../components/Skeletons';

function MetricCard({ icon, iconBg, iconColor, label, value, badge, badgeClass, onClick }) {
  const isClickable = !!onClick;
  return (
    <div 
      className={`stat-card ${isClickable ? 'clickable' : ''}`} 
      onClick={onClick}
    >
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Optimized: single summary object from new admin-summary endpoint
  const [adminSummary, setAdminSummary] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    totalPayroll: 0,
    pendingLeaves: 0,
    totalSpaces: 0,
    activeContracts: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Lightweight attendance for the attendance chart (current month only, not all history)
  const [attendance, setAttendance] = useState([]);

  // Dynamic Dashboard States
  const [worklogs, setWorklogs] = useState([]);
  const [worklogDays, setWorklogDays] = useState(7);
  const [employees, setEmployees] = useState([]);
  const [employeeDays, setEmployeeDays] = useState(30);
  const [loadingWorklogs, setLoadingWorklogs] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [queries, setQueries] = useState([]);

  const fetchQueries = () => {
    noticesApi.getQueries()
      .then(res => { setQueries(res.data || []); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  useEffect(() => {
    setLoading(true);
    // Fetch user list for display + lightweight attendance for the chart
    Promise.all([
      usersApi.getUsers().then(r => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => setUsers([])),
      attendanceApi.getAllAttendance().then(r => setAttendance(Array.isArray(r.data) ? r.data : [])).catch(() => setAttendance([])),
    ]).finally(() => setLoading(false));
  }, [user?.empId]);

  // NEW: Single optimized call for all admin metrics (replaces 5+ calls)
  useEffect(() => {
    if (!user?.empId) return;
    setLoadingSummary(true);
    dashboardApi.getAdminSummary()
      .then(res => {
        if (res.data) setAdminSummary(res.data);
      })
      .catch(err => {
        console.error('[AdminDashboard] admin-summary failed, keeping defaults', err);
      })
      .finally(() => setLoadingSummary(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empId]);

  useEffect(() => {
    if (!user?.empId) return;
    setLoadingWorklogs(true);
    dashboardApi.getRecentWorklogs(worklogDays)
      .then(res => {
        setWorklogs(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error("Error fetching recent worklogs:", err);
        setWorklogs([]);
      })
      .finally(() => setLoadingWorklogs(false));
  }, [user?.empId, worklogDays]);

  useEffect(() => {
    if (!user?.empId) return;
    setLoadingEmployees(true);
    dashboardApi.getRecentEmployees(employeeDays)
      .then(res => {
        setEmployees(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error("Error fetching recent employees:", err);
        setEmployees([]);
      })
      .finally(() => setLoadingEmployees(false));
  }, [user?.empId, employeeDays]);

  const pendingQueries = queries.filter(q => q.status !== 'Solved').length;

  // Derive values from the optimized admin-summary
  const presentTodayCount = adminSummary.presentToday;
  const payrollSum = adminSummary.totalPayroll;



  const formatRupees = (amount) => {
    if (amount >= 100000) {
      const lakhs = amount / 100000;
      return `₹${lakhs.toFixed(1)}L`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Group attendance by day for the current month
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthLabel = today.toLocaleString('default', { month: 'short' });

  const currentMonthAttendance = attendance.filter(a => {
    if (!a.clockIn) return false;
    const d = new Date(a.clockIn);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const dailyCounts = {};
  currentMonthAttendance.forEach(a => {
    const dateStr = new Date(a.clockIn).getDate();
    if (!dailyCounts[dateStr]) {
      dailyCounts[dateStr] = new Set();
    }
    dailyCounts[dateStr].add(a.empId);
  });

  // Generate data for the last 10 days of the current month
  const chartData = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    
    // Only show dates within the current month
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const dayOfMonth = d.getDate();
      const presentCount = dailyCounts[dayOfMonth] ? dailyCounts[dayOfMonth].size : 0;
      
      chartData.push({
        day: dayOfMonth,
        label: d.toLocaleDateString('default', { weekday: 'short', day: 'numeric' }),
        count: presentCount
      });
    }
  }

  // Fallback if chartData is empty (e.g. first day of the month)
  if (chartData.length === 0) {
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayOfMonth = d.getDate();
      const presentCount = dailyCounts[dayOfMonth] ? dailyCounts[dayOfMonth].size : 0;
      
      chartData.push({
        day: dayOfMonth,
        label: d.toLocaleDateString('default', { weekday: 'short', day: 'numeric' }),
        count: presentCount
      });
    }
  }

  return (
    <AppLayout role="admin">
      <div className="page-content fade-in">
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Admin Dashboard</h1>
          <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
            Welcome back, {user?.name?.split(' ')[0] || 'Admin'}. Your Space ID is <strong style={{color: 'var(--primary-600)', background: 'var(--primary-50)', padding: '2px 6px', borderRadius: 4}}>#{user?.spaceId}</strong>. Share this with your employees to join.
          </p>
        </div>

        {/* Metrics */}
        {loading ? <DashboardStatsSkeleton /> : (
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            <MetricCard 
              icon="group" 
              iconBg="#EEF2FF" 
              iconColor="#4F46E5" 
              label="Total Employees" 
              value={users.length} 
              badge={`${users.filter(u => (u.status || '').toLowerCase() === 'active').length} active`} 
              badgeClass="badge-success" 
              onClick={() => navigate('/admin/users')}
            />
            <MetricCard 
              icon="help_center" 
              iconBg="#FEE2E2" 
              iconColor="#DC2626" 
              label="Pending Queries" 
              value={pendingQueries} 
              badge={pendingQueries > 0 ? "Urgent" : "Clear"} 
              badgeClass={pendingQueries > 0 ? "badge-error" : "badge-success"} 
              onClick={() => navigate('/admin/queries')}
            />
            <MetricCard 
              icon="payments" 
              iconBg="#D1FAE5" 
              iconColor="#059669" 
              label="This Month's Payroll" 
              value={loadingSummary ? "..." : formatRupees(payrollSum)} 
              badge="On Track" 
              badgeClass="badge-success" 
              onClick={() => navigate('/admin/spaces')}
            />
            <MetricCard 
              icon="event_available" 
              iconBg="#FEF3C7" 
              iconColor="#D97706" 
              label="Present Today" 
              value={presentTodayCount} 
              badge={presentTodayCount > 0 ? "Good" : "—"} 
              badgeClass="badge-warning" 
              onClick={() => navigate('/admin/attendance')}
            />
          </div>
        )}

        {/* Main grid */}
        <div className="admin-main-grid">
          {/* Recent Worklogs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Recent Worklogs</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select 
                  value={worklogDays} 
                  onChange={(e) => setWorklogDays(Number(e.target.value))}
                  style={{ 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--gray-300)', 
                    fontSize: '12px',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    background: '#fff'
                  }}
                >
                  <option value={1}>Today</option>
                  <option value={7}>Last 7 Days</option>
                  <option value={30}>Last 30 Days</option>
                </select>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Task</th>
                    <th>Hours</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingWorklogs ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-400)', fontSize: 13 }}>
                        Loading worklogs...
                      </td>
                    </tr>
                  ) : worklogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-400)', fontSize: 13 }}>
                        No worklogs found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    worklogs.map((w, i) => {
                      const displayName = w.name && w.name.trim() ? w.name.trim() : 'Employee';
                      const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'EM';
                      return (
                        <tr key={w.logId || i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                                {initials}
                              </div>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{displayName}</span>
                                <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>ID: {w.empId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-600)', fontFamily: 'JetBrains Mono' }}>
                            {new Date(w.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-500)', fontFamily: 'JetBrains Mono' }}>
                            {w.clockIn ? new Date(w.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-500)', fontFamily: 'JetBrains Mono' }}>
                            {w.clockOut ? new Date(w.clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.taskTitle}>
                            {w.taskTitle || <span style={{ fontStyle: 'italic', color: 'var(--gray-400)' }}>Unknown Task</span>}
                          </td>
                          <td style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-600)' }}>
                            {w.hoursWorked} hrs
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-600)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.description}>
                            {w.description || <span style={{ fontStyle: 'italic', color: 'var(--gray-400)' }}>No description</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance Trend Chart */}
          <div className="card" style={{
            background: '#fff',
            borderRadius: 'var(--radius-xl)',
            padding: '20px 24px',
            border: '1px solid var(--gray-200)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>Attendance Trend</h2>
                <span className="badge badge-success" style={{ fontSize: 10 }}>{monthLabel} {today.getFullYear()}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 20 }}>
                Daily present employee count over the last 10 days
              </p>
              
              {/* Bars Container */}
              <div style={{
                height: 140,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                position: 'relative',
                paddingTop: 10,
                marginBottom: 16
              }}>
                {/* Horizontal Guide Lines */}
                <div style={{ position: 'absolute', inset: '10px 0 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                  {[1, 2, 3].map(line => (
                    <div key={line} style={{ width: '100%', borderTop: '1px dashed var(--gray-100)' }} />
                  ))}
                </div>

                {chartData.map((data, index) => {
                  const maxCount = Math.max(...chartData.map(d => d.count), 5); // Fallback max to 5 to avoid divide by zero
                  const pct = (data.count / maxCount) * 100;
                  
                  return (
                    <div 
                      key={index} 
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: 1,
                        zIndex: 2,
                        position: 'relative'
                      }}
                    >
                      {/* Tooltip on hover */}
                      <div className="chart-tooltip" style={{
                        position: 'absolute',
                        bottom: `${pct + 10}%`,
                        background: 'var(--gray-900)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '4px 6px',
                        borderRadius: 4,
                        opacity: 0,
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        pointerEvents: 'none',
                        transform: 'translateY(4px) scale(0.95)',
                        whiteSpace: 'nowrap',
                        boxShadow: 'var(--shadow-md)'
                      }}>
                        {data.count} present
                      </div>

                      {/* Bar */}
                      <div 
                        style={{
                          width: '60%',
                          maxWidth: 16,
                          height: `${pct}%`,
                          minHeight: data.count > 0 ? 4 : 0,
                          background: 'linear-gradient(to top, var(--primary-600), var(--primary-400))',
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                          cursor: 'pointer',
                          transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--primary-500)';
                          const tooltip = e.currentTarget.previousSibling;
                          if (tooltip) {
                            tooltip.style.opacity = '1';
                            tooltip.style.transform = 'translateY(0) scale(1)';
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'linear-gradient(to top, var(--primary-600), var(--primary-400))';
                          const tooltip = e.currentTarget.previousSibling;
                          if (tooltip) {
                            tooltip.style.opacity = '0';
                            tooltip.style.transform = 'translateY(4px) scale(0.95)';
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X-axis Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gray-200)', paddingTop: 8 }}>
                {chartData.map((data, index) => (
                  <div key={index} style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--gray-500)',
                    fontFamily: 'JetBrains Mono',
                    transform: 'rotate(-30deg)',
                    transformOrigin: 'top center',
                    whiteSpace: 'nowrap',
                    marginTop: 2
                  }}>
                    {data.day}
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Summary */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 36,
              paddingTop: 16,
              borderTop: '1px solid var(--gray-100)'
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total Staff</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>{users.length}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Active Rate</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>
                  {users.length > 0 ? `${((presentTodayCount / users.length) * 100).toFixed(0)}%` : '0%'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent employees */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Recent Employees Joined</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select 
                value={employeeDays} 
                onChange={(e) => setEmployeeDays(Number(e.target.value))}
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--gray-300)', 
                  fontSize: '12px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  background: '#fff'
                }}
              >
                <option value={1}>Today</option>
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Space</th>
                <th>Joining Date</th>
              </tr>
            </thead>
            <tbody>
              {loadingEmployees ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-400)', fontSize: 13 }}>
                    Loading employees...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-400)', fontSize: 13 }}>
                    No recent employees joined in the last {employeeDays} days.
                  </td>
                </tr>
              ) : (
                employees.map((u, i) => {
                  const displayName = u.name && u.name.trim() ? u.name.trim() : (u.email || 'Employee');
                  const avatarChar = displayName[0].toUpperCase();
                  return (
                    <tr key={u.empId || i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar">{avatarChar}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{u.role}</span></td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--gray-500)' }}>
                        {u.spaceName ? `${u.spaceName}` : 'No Space'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--gray-400)', fontFamily: 'JetBrains Mono' }}>
                        {u.dateOfJoining ? new Date(u.dateOfJoining).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
