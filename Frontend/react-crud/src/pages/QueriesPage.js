import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { noticesApi } from '../api/index';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

const STATUS_STYLE = {
  Open: 'badge-error',
  InProgress: 'badge-warning',
  'In Progress': 'badge-warning',
  Solved: 'badge-success',
};

const parseNoticeText = (text) => {
  if (!text) return { title: 'System Query', description: '' };
  const colonIndex = text.indexOf(': ');
  if (colonIndex > -1) {
    return {
      title: text.substring(0, colonIndex),
      description: text.substring(colonIndex + 2)
    };
  }
  return { title: 'Query Topic', description: text };
};

export default function QueriesPage({ isAdmin }) {
  const { user } = useAuth();
  const [queries, setQueries] = useState([]);
  const [notices, setNotices] = useState([]);
  const [tab, setTab] = useState('queries');
  const [expandedId, setExpandedId] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Query creation form state
  const [queryForm, setQueryForm] = useState({ title: '', description: '', preference: 'Admin' });
  const [queryErrors, setQueryErrors] = useState({});

  // Notice creation form state (Admin-only)
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ text: '', type: 'Notice' });

  const fetchQueries = async () => {
    try {
      const res = await noticesApi.getQueries();
      setQueries(res.data || []);
    } catch (err) {
      console.warn('Failed to load queries silently', err);
    }
  };

  const fetchNotices = async () => {
    if (!user?.spaceId) return;
    try {
      const res = await noticesApi.getNoticesBySpace(user.spaceId);
      if (res.data) {
        // filter out queries to avoid duplicates in the General Notices & Warnings tabs
        const filtered = res.data.filter(n => n.toType !== 'Query').map(n => ({
          id: n.noticeId,
          title: n.toType === 'Warning' ? 'System Warning' : 'Office Announcement',
          description: n.noticeText,
          createdBy: n.adminId === user.empId ? 'You' : `User #${n.adminId || 'System'}`,
          target: n.toType,
          type: n.toType === 'Warning' ? 'Warning' : 'General',
          date: n.createdAt ? new Date(n.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          isResolved: false
        }));
        setNotices(filtered);
      }
    } catch (err) {
      console.warn('Failed to load notices silently', err);
    }
  };

  useEffect(() => {
    if (!user?.spaceId) return;
    fetchQueries();
    fetchNotices();
  }, [user]);

  const validateQuery = () => {
    const errs = {};
    if (!queryForm.title.trim()) errs.title = 'Title is required';
    if (queryForm.description.trim().length < 10) errs.description = 'Describe your query in detail (min 10 chars)';
    setQueryErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRaiseQuery = async (e) => {
    e.preventDefault();
    if (!validateQuery()) return;
    setSubmitting(true);
    try {
      await noticesApi.createNotice({
        adminId: user?.empId,
        spaceId: user?.spaceId,
        noticeText: `${queryForm.title}: ${queryForm.description}`,
        toType: 'Query',
        preference: queryForm.preference || null
      });
      toast.success('Query raised successfully!');
      setQueryForm({ title: '', description: '', preference: 'Admin' });
      fetchQueries();
    } catch {
      toast.error('Failed to submit query.');
    }
    setSubmitting(false);
  };

  const handleReply = async (queryId) => {
    const text = replyText[queryId];
    if (!text?.trim()) return;
    try {
      await noticesApi.replyToQuery(queryId, text);
      toast.success('Reply submitted!');
      setReplyText(prev => ({ ...prev, [queryId]: '' }));
      fetchQueries();
    } catch {
      toast.error('Failed to submit reply.');
    }
  };

  const handleToggleSolve = async (queryId, currentStatus) => {
    const newStatus = currentStatus === 'Solved' ? 'Open' : 'Solved';
    try {
      await noticesApi.updateQueryStatus(queryId, newStatus);
      toast.success(`Query marked as ${newStatus}!`);
      fetchQueries();
    } catch {
      toast.error('Failed to update query status.');
    }
  };

  const handleDeleteQuery = async (queryId) => {
    if (!window.confirm('Are you sure you want to delete this query?')) return;
    try {
      await noticesApi.deleteQuery(queryId);
      toast.success('Query deleted successfully.');
      fetchQueries();
    } catch {
      toast.error('Failed to delete query.');
    }
  };

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!noticeForm.text.trim()) {
      toast.error('Content text is required.');
      return;
    }
    setSubmitting(true);
    try {
      await noticesApi.createNotice({
        adminId: user?.empId,
        spaceId: user?.spaceId,
        noticeText: noticeForm.text,
        toType: noticeForm.type
      });
      toast.success(`${noticeForm.type} published successfully!`);
      setNoticeForm({ text: '', type: 'Notice' });
      setShowNoticeForm(false);
      fetchNotices();
    } catch {
      toast.error('Failed to publish.');
    }
    setSubmitting(false);
  };

  const renderPreferenceText = (pref) => {
    if (pref === 'TL') return 'Team Lead';
    if (pref === 'Admin') return 'Administrator';
    if (pref === 'Manager') return 'Manager';
    return 'Space-wide';
  };

  const renderPreferenceBadgeClass = (pref) => {
    if (pref === 'Admin') return 'badge-info';
    if (pref === 'TL') return 'badge-primary';
    if (pref === 'Manager') return 'badge-warning';
    return 'badge-gray';
  };

  return (
    <AppLayout role={isAdmin ? 'admin' : 'employee'}>
      <div className="page-content fade-in">
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Queries & Notices</h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>Route queries dynamically and view announcements</p>
          </div>
        </div>

        <div className="tabs">
          {[['queries', 'Queries'], ['notices', 'General Notices'], ['warnings', 'Warnings']].map(([key, label]) => (
            <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {/* Queries tab */}
        {tab === 'queries' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Raise query form */}
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Raise a Query</h3>
              <form onSubmit={handleRaiseQuery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input 
                    className={`form-input ${queryErrors.title ? 'input-error' : ''}`} 
                    placeholder="Brief summary of your issue" 
                    value={queryForm.title} 
                    onChange={e => setQueryForm(p => ({ ...p, title: e.target.value }))} 
                  />
                  {queryErrors.title && <span className="form-error">{queryErrors.title}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Routing</label>
                  <select 
                    className="form-select" 
                    value={queryForm.preference} 
                    onChange={e => setQueryForm(p => ({ ...p, preference: e.target.value }))}
                  >
                    <option value="Admin">Admin (Workspace Owner)</option>
                    <option value="TL">Team Lead</option>
                    <option value="Manager">Manager</option>
                    <option value="">None (Space-wide Query)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea 
                    className={`form-input ${queryErrors.description ? 'input-error' : ''}`} 
                    rows={4} 
                    placeholder="Describe your query in detail..." 
                    value={queryForm.description} 
                    onChange={e => setQueryForm(p => ({ ...p, description: e.target.value }))} 
                  />
                  {queryErrors.description && <span className="form-error">{queryErrors.description}</span>}
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifyContent: 'center' }}>
                  {submitting ? <><div className="spinner" />Submitting...</> : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>Submit Query</>}
                </button>
              </form>
            </div>

            {/* Query list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {queries.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 8 }}>quiz</span>
                  No queries found
                </div>
              ) : queries.map(q => {
                const { title, description } = parseNoticeText(q.noticeText);
                
                // Visibility rules state:
                // Only assigned person can reply (TL, Manager, Admin).
                // Admin has full control and can reply to any query.
                // Space queries (employeeId = null) can be replied by Admin, TL, or Manager.
                const canReply = user?.role === 'Admin' || 
                                 (q.employeeId === user?.empId) ||
                                 (q.employeeId === null && (user?.role === 'Admin' || user?.role === 'TeamLead' || user?.role === 'Manager'));
                const canResolve = canReply;

                return (
                  <div key={q.noticeId} className="card" style={{ transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</h4>
                        <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: '1.4' }}>{description}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0, marginLeft: 16 }}>
                        <span className={`badge ${STATUS_STYLE[q.status] || 'badge-gray'}`}>{q.status}</span>
                        <span style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'JetBrains Mono' }}>
                          {q.createdAt ? new Date(q.createdAt).toISOString().split('T')[0] : 'Today'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`badge ${renderPreferenceBadgeClass(q.preference)}`}>
                          Route: {renderPreferenceText(q.preference)}
                        </span>
                        <span className="badge badge-gray">
                          Created by #{q.adminId === user?.empId ? 'You' : q.adminId}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {user?.role === 'Admin' && (
                          <button 
                            className="icon-btn" 
                            style={{ color: 'var(--error-600)', padding: 4 }} 
                            onClick={() => handleDeleteQuery(q.noticeId)}
                            title="Delete Query"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedId(expandedId === q.noticeId ? null : q.noticeId)}>
                          {expandedId === q.noticeId ? 'Hide Actions' : 'View / Reply'}
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                            {expandedId === q.noticeId ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {expandedId === q.noticeId && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Reply Rendering */}
                        {q.reply ? (
                          <div style={{ display: 'flex', gap: 10 }}>
                            <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, background: 'var(--success-100)', color: 'var(--success-700)' }}>R</div>
                            <div style={{ flex: 1, background: 'var(--success-50)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--success-100)' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--success-900)' }}>
                                Response from User #{q.repliedBy}
                              </div>
                              <p style={{ fontSize: 13, color: 'var(--gray-700)', margin: 0, lineHeight: '1.4' }}>{q.reply}</p>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: 12, margin: 0 }}>No response yet</p>
                        )}

                        {/* Controls Block */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                          {canReply && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input 
                                className="form-input" 
                                placeholder={q.reply ? "Update the response..." : "Write a response..."} 
                                value={replyText[q.noticeId] || ''} 
                                onChange={e => setReplyText(p => ({ ...p, [q.noticeId]: e.target.value }))} 
                                onKeyDown={e => e.key === 'Enter' && handleReply(q.noticeId)} 
                              />
                              <button className="btn btn-primary btn-sm" onClick={() => handleReply(q.noticeId)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                              </button>
                            </div>
                          )}

                          {canResolve && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button 
                                className={`btn btn-sm ${q.status === 'Solved' ? 'btn-ghost' : 'btn-primary'}`} 
                                onClick={() => handleToggleSolve(q.noticeId, q.status)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                  {q.status === 'Solved' ? 'settings_backup_restore' : 'check_circle'}
                                </span>
                                {q.status === 'Solved' ? 'Reopen Query' : 'Resolve Query'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notices tab */}
        {tab === 'notices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {user?.role === 'Admin' && (
              <div style={{ marginBottom: 8 }}>
                <button className="btn btn-primary" onClick={() => setShowNoticeForm(!showNoticeForm)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  {showNoticeForm ? 'Cancel Creation' : 'Publish Announcement / Warning'}
                </button>
              </div>
            )}

            {/* Admin notice creation form */}
            {showNoticeForm && (
              <div className="card" style={{ maxWidth: 600, border: '1px solid var(--primary-100)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Publish Notice or Warning</h3>
                <form onSubmit={handleCreateNotice} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select 
                      className="form-select" 
                      value={noticeForm.type} 
                      onChange={e => setNoticeForm(p => ({ ...p, type: e.target.value }))}
                    >
                      <option value="Notice">Office Announcement (Notice)</option>
                      <option value="Warning">Official Warning</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Content</label>
                    <textarea 
                      className="form-input" 
                      rows={4} 
                      placeholder="Write your announcement details here..." 
                      value={noticeForm.text} 
                      onChange={e => setNoticeForm(p => ({ ...p, text: e.target.value }))} 
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Publishing...' : 'Publish Now'}
                  </button>
                </form>
              </div>
            )}

            {notices.filter(n => n.type === 'General').length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>No announcements posted yet.</div>
            ) : (
              notices.filter(n => n.type === 'General').map(n => (
                <div key={n.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, background: 'var(--info-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--info)' }}>campaign</span>
                      </div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</h4>
                        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>By {n.createdBy} · {n.date}</span>
                      </div>
                    </div>
                    <span className="badge badge-info">{n.target}</span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: '1.4' }}>{n.description}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Warnings tab */}
        {tab === 'warnings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {notices.filter(n => n.type === 'Warning').map(n => (
              <div key={n.id} className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, background: 'var(--warning-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--warning)' }}>warning</span>
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</h4>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>By {n.createdBy} · {n.date}</span>
                    </div>
                  </div>
                  {n.isResolved && <span className="badge badge-success">Resolved</span>}
                </div>
                <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: '1.4' }}>{n.description}</p>
              </div>
            ))}
            {notices.filter(n => n.type === 'Warning').length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 8 }}>check_circle</span>
                No warnings on record
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
