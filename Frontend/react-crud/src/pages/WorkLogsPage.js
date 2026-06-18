import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { projectsApi } from '../api/projects';
import { worklogsApi } from '../api/worklogs';
import toast from 'react-hot-toast';
import axios from '../api/client';

const DRAFT_KEY = 'worklog_draft_v2';

export default function WorkLogsPage() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimer = useRef(null);
  const autoSaveTimer = useRef(null);

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    return saved ? JSON.parse(saved) : { taskId: '', hoursWorked: '', description: '', taskStatus: 'Pending' };
  });
  const [errors, setErrors] = useState({});

  const fetchTasks = async () => {
    try {
      const res = await axios.get("/api/worklogs/tasks");
      setTasks(res.data.data || []);
      console.log("Tasks from Worklogs API:", res.data.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setTasks([]);
    }
  };

  // Load projects and tasks for dropdown
  useEffect(() => {
    fetchTasks();

    const ac = new AbortController();
    setLoadingProjects(true);
    projectsApi.getProjects(ac.signal)
      .then(r => setProjects(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));

    return () => ac.abort();
  }, []);

  const fetchLogs = useCallback(() => {
    setLoadingLogs(true);
    worklogsApi.getMyWorklogs()
      .then(r => setLogs(r.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false));
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-save draft every 30s when form is dirty
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (form.taskId || form.description) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      }
    }, 30000);
    return () => clearInterval(autoSaveTimer.current);
  }, [form]);

  const handleSearch = useCallback((e) => {
    clearTimeout(searchTimer.current);
    const q = e.target.value;
    searchTimer.current = setTimeout(() => setSearchQuery(q), 300);
  }, []);

  const validate = () => {
    const e = {};
    if (!form.taskId) e.taskId = 'Select a task';
    const h = parseFloat(form.hoursWorked);
    if (!form.hoursWorked || isNaN(h)) e.hoursWorked = 'Enter valid hours';
    else if (h < 0.5) e.hoursWorked = 'Minimum 0.5 hours';
    else if (h > 24) e.hoursWorked = 'Maximum 24 hours';
    if (!form.description || form.description.trim().length < 5)
      e.description = 'Description must be at least 5 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await worklogsApi.createWorklog({
        taskId: parseInt(form.taskId),
        hoursWorked: parseFloat(form.hoursWorked),
        description: form.description.trim(),
        taskStatus: form.taskStatus,
      });
      toast.success('✅ Work log saved to database!');
      setForm({ taskId: '', hoursWorked: '', description: '', taskStatus: 'Pending' });
      setErrors({});
      localStorage.removeItem(DRAFT_KEY);
      fetchLogs();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save work log.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLogs = logs.filter(l =>
    !searchQuery ||
    l.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalHours = logs.reduce((acc, l) => acc + (parseFloat(l.hoursWorked) || 0), 0);

  const getProjectForTask = (taskId) => {
    const task = tasks.find(t => t.taskId === parseInt(taskId) || t.taskid === parseInt(taskId));
    if (!task) return '';
    return projects.find(p => p.projectId === task.projectId || p.projectid === task.projectid)?.projectName || '';
  };

  return (
    <AppLayout role="employee">
      <div className="page-content fade-in">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Work Logs</h1>
          <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>Log your daily work — saved directly to database</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-3" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Logs', value: logs.length, icon: 'list_alt', bg: '#EEF2FF', color: '#4F46E5' },
            { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, icon: 'schedule', bg: '#D1FAE5', color: '#059669' },
            { label: 'Assigned Tasks', value: tasks.length, icon: 'task_alt', bg: '#FEF3C7', color: '#D97706' },
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

        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Log Work Form */}
          <div className="card" style={{ position: 'sticky', top: 80 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Add Work Log</h3>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div className="form-group">
                <label className="form-label">Task *</label>
                {loadingProjects ? (
                  <div style={{ height: 36, background: 'var(--gray-100)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                ) : (
                  <select
                    className={`form-select ${errors.taskId ? 'input-error' : ''}`}
                    value={form.taskId}
                    onChange={e => {
                      const taskIdVal = e.target.value;
                      const selectedTask = tasks.find(t => (t.taskId || t.taskid) === parseInt(taskIdVal));
                      const currentStatus = selectedTask ? (selectedTask.status || selectedTask.taskStatus || selectedTask.taskstatus || 'Pending') : 'Pending';
                      setForm(f => ({ ...f, taskId: taskIdVal, taskStatus: currentStatus }));
                    }}
                  >
                    <option value="">Select a task</option>
                    {tasks.length === 0 ? (
                      <option disabled>No tasks assigned yet</option>
                    ) : (
                      tasks.map(task => (
                        <option key={task.taskid || task.taskId} value={task.taskid || task.taskId}>
                          {task.title || task.taskTitle} ({task.projectname || task.projectName})
                        </option>
                      ))
                    )}
                  </select>
                )}
                {errors.taskId && <span className="form-error">{errors.taskId}</span>}
              </div>
 
              <div className="form-group">
                <label className="form-label">Update Task Status *</label>
                <select
                  className="form-select"
                  value={form.taskStatus || 'Pending'}
                  onChange={e => setForm(f => ({ ...f, taskStatus: e.target.value }))}
                  disabled={!form.taskId}
                >
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Resolve">Resolve</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Hours Worked * <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>(0.5 – 24)</span></label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  className={`form-input ${errors.hoursWorked ? 'input-error' : ''}`}
                  placeholder="e.g. 6.5"
                  value={form.hoursWorked}
                  onChange={e => setForm(f => ({ ...f, hoursWorked: e.target.value }))}
                />
                {errors.hoursWorked && <span className="form-error">{errors.hoursWorked}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className={`form-input ${errors.description ? 'input-error' : ''}`}
                  placeholder="Describe what you worked on today..."
                  rows={4}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                {errors.description && <span className="form-error">{errors.description}</span>}
                <div style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'right', marginTop: 2 }}>
                  {form.description.length} chars
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifyContent: 'center' }}>
                {submitting
                  ? <><div className="spinner" />Saving to DB...</>
                  : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>Submit Work Log</>
                }
              </button>

              {(form.taskId || form.description) && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }}
                  onClick={() => { setForm({ taskId: '', hoursWorked: '', description: '', taskStatus: 'Pending' }); localStorage.removeItem(DRAFT_KEY); }}>
                  Clear Draft
                </button>
              )}
            </form>
          </div>

          {/* Right side */}
          <div>
            {/* Assigned Projects */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Your Assigned Projects</h3>
              {loadingProjects ? (
                <div className="grid grid-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card" style={{ height: 120, background: 'var(--gray-50)', animation: 'pulse 1.5s infinite' }} />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>folder_off</span>
                  No projects assigned yet
                </div>
              ) : (
                <div className="grid grid-3">
                  {projects.map(p => (
                    <div key={p.projectId || p.projectid} className="card" style={{ cursor: 'default' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>{p.projectName || p.projectname}</h4>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary-500)' }}>folder_open</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>{p.description}</p>
                      {p.startDate && (
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                          Started: {new Date(p.startDate || p.startdate).toLocaleDateString('en-IN')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Work Log History */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Work Log History</h3>
                <div className="search-bar">
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--gray-400)' }}>search</span>
                  <input placeholder="Search logs..." onChange={handleSearch} aria-label="Search work logs" />
                </div>
              </div>

              {loadingLogs ? (
                <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Loading logs from database...</span>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Project</th>
                          <th>Task</th>
                          <th>Hours</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                              {logs.length === 0
                                ? 'No work logs yet. Submit your first log!'
                                : 'No logs match your search.'}
                            </td>
                          </tr>
                        ) : filteredLogs.map(log => (
                          <tr key={log.logId || log.logid}>
                            <td style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                              {new Date(log.workDate || log.workdate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ fontWeight: 600, fontSize: 13 }}>{log.projectName || log.projectname || '—'}</td>
                            <td><span className="badge badge-primary">{log.title || '—'}</span></td>
                            <td style={{ fontWeight: 700, color: 'var(--primary-500)' }}>{parseFloat(log.hoursWorked || log.hoursworked || 0).toFixed(1)}h</td>
                            <td style={{ fontSize: 12, color: 'var(--gray-500)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
