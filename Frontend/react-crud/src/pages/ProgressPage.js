import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { worklogsApi } from '../api/worklogs';
import { payrollApi } from '../api/payroll';
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
    'Completed':   { bg: '#D1FAE5', color: '#065F46' },
    'Complete':    { bg: '#D1FAE5', color: '#065F46' },
    'Resolve':     { bg: '#D1FAE5', color: '#065F46' },
    'InProgress':  { bg: '#DBEAFE', color: '#1D4ED8' },
    'In Progress': { bg: '#DBEAFE', color: '#1D4ED8' },
    'Active':      { bg: '#DBEAFE', color: '#1D4ED8' },
    'Pending':     { bg: '#FEF3C7', color: '#92400E' },
  };
  const style = map[status] || { bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: style.bg, color: style.color
    }}>{status}</span>
  );
}

export default function ProgressPage() {
  const [tasks, setTasks] = useState([]);
  const [report, setReport] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);

  useEffect(() => {
    const ac = new AbortController();

    worklogsApi.getMyTaskProgress(ac.signal)
      .then(r => setTasks(r.data?.data || r.data || []))
      .catch(() => toast.error('Could not load task progress'))
      .finally(() => setLoadingTasks(false));

    payrollApi.getMyProgress(ac.signal)
      .then(r => setReport(r.data || null))
      .catch(() => {})
      .finally(() => setLoadingReport(false));

    return () => ac.abort();
  }, []);

  const completionPct = report
    ? (report.totalTasks > 0 ? Math.round((report.completedTasks / report.totalTasks) * 100) : 0)
    : 0;

  return (
    <AppLayout role="employee">
      <div className="page-content fade-in">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Progress Report</h1>
          <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>Your work progress, task completion and attendance summary</p>
        </div>

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
              <p style={{ fontSize: 13 }}>Tasks assigned to you will appear here with progress tracking</p>
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
      </div>
    </AppLayout>
  );
}
