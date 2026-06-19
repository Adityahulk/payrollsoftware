import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { worklogsApi } from '../api/worklogs';
import { payrollApi } from '../api/payroll';

import { usersApi } from '../api';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

function ProgressBar({ value, color = 'var(--primary-500)', height = 8 }) {
  return (
    <div style={{ background: 'var(--gray-100)', borderRadius: 999, height, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(value, 100)}%`, height: '100%',
        background: color, borderRadius: 999,
        transition: 'width 0.8s cubic-bezier(.4,0,.2,1)'
      }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    'Completed': { bg: '#D1FAE5', color: '#065F46' },
    'Complete': { bg: '#D1FAE5', color: '#065F46' },
    'Resolve': { bg: '#D1FAE5', color: '#065F46' },
    'InProgress': { bg: '#DBEAFE', color: '#1D4ED8' },
    'In Progress': { bg: '#DBEAFE', color: '#1D4ED8' },
    'Active': { bg: '#DBEAFE', color: '#1D4ED8' },
    'Pending': { bg: '#FEF3C7', color: '#92400E' },
  };
  const style = map[status] || { bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: style.bg, color: style.color
    }}>{status}</span>
  );
}

export default function ProgressPage({ isAdmin = false }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [report, setReport] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);

  // Admin Roster states
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(isAdmin);

  // Load roster for administrators
  useEffect(() => {
    if (isAdmin) {
      setLoadingRoster(true);
      usersApi.getCompanyUsers()
        .then(res => {
          const list = res.data || [];
          const activeEmps = list.filter(u => (u.role || '').toLowerCase() !== 'admin');
          setEmployees(activeEmps);
          if (activeEmps.length > 0) {
            setSelectedEmpId(activeEmps[0].empId);
          } else {
            setLoadingTasks(false);
            setLoadingReport(false);
          }
        })
        .catch(err => {
          console.error("Failed to load company employees for progress report:", err);
          toast.error("Failed to load employee list.");
          setLoadingTasks(false);
          setLoadingReport(false);
        })
        .finally(() => {
          setLoadingRoster(false);
        });
    }
  }, [isAdmin]);

  // Load task and report details
  useEffect(() => {
    if (isAdmin && !selectedEmpId) return;

    const ac = new AbortController();
    setLoadingTasks(true);
    setLoadingReport(true);

    const taskPromise = isAdmin
      ? worklogsApi.getTaskProgressByEmpId(selectedEmpId, ac.signal)
      : worklogsApi.getMyTaskProgress(ac.signal);

    taskPromise
      .then(r => setTasks(r.data?.data || r.data || []))
      .catch(() => toast.error('Could not load task progress'))
      .finally(() => setLoadingTasks(false));

    const progressPromise = isAdmin
      ? payrollApi.getProgressByEmpId(selectedEmpId, ac.signal)
      : payrollApi.getMyProgress(ac.signal);

    progressPromise
      .then(r => setReport(r.data || null))
      .catch(() => { })
      .finally(() => setLoadingReport(false));

    return () => ac.abort();
  }, [isAdmin, selectedEmpId]);

  const completionPct = report
    ? (report.totalTasks > 0 ? Math.round((report.completedTasks / report.totalTasks) * 100) : 0)
    : 0;

  const handleExportExcel = () => {
    if (!report) {
      toast.error('No progress data available to export.');
      return;
    }

    const empName = isAdmin
      ? (employees.find(e => e.empId === Number(selectedEmpId))?.name || `Employee_${selectedEmpId}`)
      : (user?.name || 'Employee');

    const empRole = isAdmin
      ? (employees.find(e => e.empId === Number(selectedEmpId))?.role || '')
      : (user?.role || '');

    const empId = isAdmin ? selectedEmpId : (user?.empId || '');

    // Generate styled HTML compatible with MS Excel
    let html = `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          th, td { border: 1px solid #E2E8F0; padding: 10px; text-align: left; }
          th { background-color: #4F46E5; color: white; font-weight: bold; }
          .header-title { font-size: 18pt; font-weight: 800; color: #4F46E5; text-align: center; height: 50px; }
          .section-header { background-color: #EEF2FF; font-weight: bold; font-size: 12pt; color: #312E81; }
          .label { font-weight: bold; color: #4B5563; background-color: #F9FAFB; }
          .value { color: #111827; }
          .task-completed { background-color: #F0FDF4; color: #15803D; }
          .task-inprogress { background-color: #EFF6FF; color: #1D4ED8; }
          .task-pending { background-color: #FEF3C7; color: #B45309; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="7" class="header-title">EMPLOYEE PROGRESS REPORT</td>
          </tr>
          <tr><td colspan="7"></td></tr>
          <tr class="section-header">
            <td colspan="7">Employee Details</td>
          </tr>
          <tr>
            <td class="label">Employee ID:</td>
            <td class="value">${empId}</td>
            <td class="label">Employee Name:</td>
            <td class="value" colspan="2">${empName}</td>
            <td class="label">Role:</td>
            <td class="value">${empRole}</td>
          </tr>
          <tr>
            <td class="label">Report Generated:</td>
            <td class="value" colspan="6">${new Date().toLocaleString()}</td>
          </tr>
          <tr><td colspan="7"></td></tr>
          <tr class="section-header">
            <td colspan="7">Overall Statistics Summary</td>
          </tr>
          <tr>
            <td class="label">Total Tasks Assigned:</td>
            <td class="value">${report.totalTasks}</td>
            <td class="label">Completed Tasks:</td>
            <td class="value">${report.completedTasks}</td>
            <td class="label">Pending Tasks:</td>
            <td class="value" colspan="2">${report.pendingTasks}</td>
          </tr>
          <tr>
            <td class="label">Task Completion Rate:</td>
            <td class="value">${completionPct}%</td>
            <td class="label">Attendance Rate:</td>
            <td class="value">${Number(report.attendancePercentage || 0).toFixed(1)}%</td>
            <td class="label">Total Hours Logged:</td>
            <td class="value" colspan="2">${Number(report.totalHoursWorked || 0).toFixed(1)} hrs</td>
          </tr>
          <tr><td colspan="7"></td></tr>
          <tr class="section-header">
            <td colspan="7">Attendance Summary (Current Month)</td>
          </tr>
          <tr>
            <td class="label">Date of Joining:</td>
            <td class="value">${report.dateOfJoining || 'N/A'}</td>
            <td class="label">Total Working Days:</td>
            <td class="value">${report.totalWorkingDays || 0}</td>
            <td class="label">Attendance Rate:</td>
            <td class="value" colspan="2">${Number(report.attendancePercentage || 0).toFixed(1)}%</td>
          </tr>
          <tr>
            <td class="label">Days Present:</td>
            <td class="value" style="background-color: #F0FDF4; color: #15803D; font-weight: bold;">${report.daysPresent || 0}</td>
            <td class="label">Days Absent:</td>
            <td class="value" style="background-color: #FEF2F2; color: #DC2626; font-weight: bold;">${report.daysAbsent || 0}</td>
            <td class="label">Approved Leaves:</td>
            <td class="value" colspan="2">${report.approvedLeaves || 0}</td>
          </tr>
          <tr>
            <td class="label">Late Arrivals:</td>
            <td class="value" style="background-color: #FEF3C7; color: #B45309; font-weight: bold;">${report.lateDays || 0}</td>
            <td class="label">Early Exits:</td>
            <td class="value" style="background-color: #FEF3C7; color: #B45309; font-weight: bold;">${report.earlyExitDays || 0}</td>
            <td colspan="3"></td>
          </tr>
          <tr><td colspan="7"></td></tr>
          <tr class="section-header">
            <td colspan="7">Detailed Task-by-Task Logs</td>
          </tr>
          <tr style="background-color: #4F46E5; color: white; font-weight: bold;">
            <td colspan="2"><b>Task Title</b></td>
            <td><b>Project Name</b></td>
            <td><b>Status</b></td>
            <td><b>Completion %</b></td>
            <td><b>Estimated Hours</b></td>
            <td><b>Actual Hours Worked</b></td>
          </tr>
    `;

    tasks.forEach(task => {
      const title = task.title || task.taskTitle || task.tasktitle || '';
      const project = task.projectName || task.projectname || '';
      const status = task.status || 'Pending';
      const pct = task.completionPercentage || task.completionpercentage || 0;
      const est = parseFloat(task.estimatedHours || task.estimatedhours || 0).toFixed(1);
      const actual = parseFloat(task.actualHours || task.actualhours || 0).toFixed(1);

      let statusClass = 'task-pending';
      if (status === 'Completed' || status === 'Complete' || status === 'Resolve') statusClass = 'task-completed';
      else if (status === 'InProgress' || status === 'In Progress' || status === 'Active') statusClass = 'task-inprogress';

      html += `
        <tr>
          <td colspan="2">${title}</td>
          <td>${project}</td>
          <td class="${statusClass}">${status}</td>
          <td>${pct}%</td>
          <td>${est}h</td>
          <td>${actual}h</td>
        </tr>
      `;
    });

    html += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Progress_Report_${empName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Excel progress report downloaded successfully!');
  };

  return (
    <AppLayout role={isAdmin ? 'admin' : 'employee'}>
      <div className="page-content fade-in">
        {/* Header section with Dropdown and Excel export */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
              {isAdmin ? "Employee Progress Report" : "Progress Report"}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              {isAdmin ? "View and track work progress, task completion and attendance summary for team roster" : "Your work progress, task completion and attendance summary"}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', fontSize: 20 }}>group</span>
                <select
                  id="employee-select"
                  className="form-select"
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  style={{ width: 220, fontWeight: 600, borderColor: 'var(--gray-300)' }}
                  aria-label="Select employee"
                >
                  {employees.length === 0 ? (
                    <option value="">No active employees</option>
                  ) : (
                    employees.map(emp => (
                      <option key={emp.empId} value={emp.empId}>
                        {emp.name} ({emp.role})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {report && (
              <button
                className="btn btn-outline"
                onClick={handleExportExcel}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                Export Excel
              </button>
            )}
          </div>
        </div>

        {/* Loading and empty states */}
        {loadingRoster ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Loading employee list...</span>
          </div>
        ) : isAdmin && employees.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>group</span>
            <p style={{ fontWeight: 600 }}>No Employees Found</p>
            <p style={{ fontSize: 13 }}>There are no active employees registered in your company roster.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            {loadingReport ? (
              <div className="grid grid-4" style={{ marginBottom: 24 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="stat-card" style={{ height: 100, animation: 'pulse 1.5s infinite', background: 'var(--gray-100)' }} />
                ))}
              </div>
            ) : report && (
              <div className="grid grid-4" style={{ marginBottom: 24 }}>
                {[
                  { label: 'Total Tasks', value: report.totalTasks, icon: 'task_alt', bg: '#EEF2FF', color: '#4F46E5' },
                  { label: 'Completed', value: report.completedTasks, icon: 'check_circle', bg: '#D1FAE5', color: '#059669' },
                  { label: 'Pending', value: report.pendingTasks, icon: 'pending', bg: '#FEF3C7', color: '#D97706' },
                  { label: 'Hours Worked', value: `${parseFloat(report.totalHoursWorked || 0).toFixed(1)}h`, icon: 'schedule', bg: '#F3E8FF', color: '#7C3AED' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="stat-card-icon" style={{ background: s.bg }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Overall progress + Attendance */}
            {report && (
              <div className="grid grid-2" style={{ marginBottom: 24 }}>
                <div className="card">
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Overall Task Completion</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                    {/* Circular indicator */}
                    <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
                      <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--gray-100)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4F46E5" strokeWidth="3"
                          strokeDasharray={`${completionPct} 100`} strokeLinecap="round" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: '#4F46E5' }}>{completionPct}%</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--gray-500)' }}>Completion</span>
                        <span style={{ fontWeight: 700 }}>{completionPct}%</span>
                      </div>
                      <ProgressBar value={completionPct} color="#4F46E5" height={10} />
                      <div style={{ marginTop: 12, fontSize: 13, color: 'var(--gray-500)' }}>
                        {report.completedTasks} of {report.totalTasks} tasks completed
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Attendance & Hours</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--gray-500)' }}>Attendance Rate</span>
                        <span style={{ fontWeight: 700 }}>{parseFloat(report.attendancePercentage || 0).toFixed(1)}%</span>
                      </div>
                      <ProgressBar value={parseFloat(report.attendancePercentage || 0)} color="#10B981" height={10} />
                    </div>

                    {/* Attendance detail stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 4 }}>
                      {[
                        { label: 'Present', value: report.daysPresent ?? '-', color: '#059669', bg: '#D1FAE5' },
                        { label: 'Absent', value: report.daysAbsent ?? '-', color: '#DC2626', bg: '#FEE2E2' },
                        { label: 'Late', value: report.lateDays ?? '-', color: '#D97706', bg: '#FEF3C7' },
                        { label: 'Leaves', value: report.approvedLeaves ?? '-', color: '#7C3AED', bg: '#F3E8FF' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: s.bg, borderRadius: 8 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                      Working Days: {report.totalWorkingDays ?? '-'} (this month up to today)
                      {report.dateOfJoining && <span> · DOJ: {report.dateOfJoining}</span>}
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--gray-500)' }}>Total Hours Logged</span>
                        <span style={{ fontWeight: 700 }}>{parseFloat(report.totalHoursWorked || 0).toFixed(1)}h</span>
                      </div>
                      <ProgressBar value={Math.min((parseFloat(report.totalHoursWorked || 0) / 160) * 100, 100)} color="#8B5CF6" height={10} />
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>Monthly target: 160h</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Task-by-task progress */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Task-by-Task Progress</h3>
              </div>

              {loadingTasks ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Loading task progress from database...</span>
                </div>
              ) : tasks.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>task_alt</span>
                  <p style={{ fontWeight: 600 }}>No tasks assigned yet</p>
                  <p style={{ fontSize: 13 }}>
                    {isAdmin ? "Tasks assigned to this employee will appear here with progress tracking" : "Tasks assigned to you will appear here with progress tracking"}
                  </p>
                </div>
              ) : (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {tasks.map(task => {
                    const pct = task.completionPercentage || task.completionpercentage || 0;
                    const est = parseFloat(task.estimatedHours || task.estimatedhours || 0);
                    const actual = parseFloat(task.actualHours || task.actualhours || 0);
                    const remaining = parseFloat(task.remainingHours || task.remaininghours || 0);
                    const status = task.status || 'Pending';
                    const statusColor = status === 'Completed' ? '#10B981' : status === 'In Progress' ? '#3B82F6' : '#F59E0B';

                    return (
                      <div key={task.taskId || task.taskid} style={{
                        padding: 16, borderRadius: 12, border: '1px solid var(--gray-100)',
                        background: status === 'Completed' ? '#F0FDF4' : 'var(--surface)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                              {task.title || task.taskTitle || task.tasktitle}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                              {task.projectName || task.projectname}
                            </div>
                          </div>
                          <StatusBadge status={status} />
                        </div>

                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                            <span style={{ color: 'var(--gray-500)' }}>Progress</span>
                            <span style={{ fontWeight: 700, color: statusColor }}>{pct}%</span>
                          </div>
                          <ProgressBar value={pct} color={statusColor} height={8} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
                          {[
                            { label: 'Estimated', value: `${est.toFixed(1)}h`, color: 'var(--gray-600)' },
                            { label: 'Worked', value: `${actual.toFixed(1)}h`, color: '#4F46E5' },
                            { label: 'Remaining', value: `${remaining.toFixed(1)}h`, color: remaining <= 0 ? '#10B981' : '#F59E0B' },
                          ].map(m => (
                            <div key={m.label} style={{ textAlign: 'center', padding: '8px 0', background: 'var(--gray-50)', borderRadius: 8 }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                              <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
