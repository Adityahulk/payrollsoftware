import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { projectsApi } from '../api/projects';
import { teamApi } from '../api/team';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import { BACKEND_ORIGIN } from '../config';

/* ─────────── Shared small components ─────────── */

function StatusBadge({ status }) {
  const map = {
    'Completed': { bg: '#D1FAE5', color: '#065F46' },
    'Complete': { bg: '#D1FAE5', color: '#065F46' },
    'Resolve': { bg: '#D1FAE5', color: '#065F46' },
    'InProgress': { bg: '#DBEAFE', color: '#1D4ED8' },
    'In Progress': { bg: '#DBEAFE', color: '#1D4ED8' },
    'Active': { bg: '#DBEAFE', color: '#1D4ED8' },
    'Pending': { bg: '#FEF3C7', color: '#92400E' },
    'Todo': { bg: '#F3F4F6', color: '#374151' },
  };
  const s = map[status] || map['Todo'];
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {status || 'Pending'}
    </span>
  );
}

const PRIORITY_COLOR = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981', Critical: '#8B5CF6' };

function PriorityBadge({ priority }) {
  const color = PRIORITY_COLOR[priority] || '#374151';
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, padding: '2px 8px', background: `${color}18`, borderRadius: 6 }}>
      {priority || 'Medium'}
    </span>
  );
}

const today = () => new Date().toISOString().split('T')[0];

const parseLinkString = (linkStr) => {
  if (!linkStr) return null;
  const idx = linkStr.indexOf('|');
  if (idx !== -1) {
    return { name: linkStr.substring(0, idx), url: linkStr.substring(idx + 1) };
  }
  return { name: linkStr, url: linkStr };
};

const renderLinksSection = (linksArray, title, icon) => {
  if (!linksArray || linksArray.length === 0) return null;

  const validLinks = linksArray
    .map(parseLinkString)
    .filter(l => l && l.name && l.url);

  if (validLinks.length === 0) return null;

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--gray-100)', paddingTop: 10 }}>
      <h5 style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {title}
      </h5>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {validLinks.map((l, i) => (
          <a
            key={i}
            href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-ghost"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--primary-600)',
              background: 'var(--primary-50)',
              padding: '4px 10px',
              borderRadius: 6,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
            {l.name}
          </a>
        ))}
      </div>
    </div>
  );
};

/* ─── Modal Overlay ─── */
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalCard = {
  background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600,
  boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
  display: 'flex', flexDirection: 'column', maxHeight: '90vh',
};
const modalHeader = {
  padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', color: '#fff',
};
const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #D1D5DB',
  fontSize: 13, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
  background: '#fff',
};
const labelStyle = { fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: '#374151' };

/* ─────────── Create Project Modal (with inline task creation) ─────────── */
function CreateProjectModal({ onClose, onCreated, teamMembers }) {
  const [form, setForm] = useState({
    projectName: '', description: '', startDate: today(), endDate: '', teamId: ''
  });
  const [links, setLinks] = useState([{ name: '', url: '' }]);
  const [docLinks, setDocLinks] = useState([{ name: '', url: '' }]);
  const [tasks, setTasks] = useState([]);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addTask = () => {
    setTasks(prev => [...prev, { assignedToEmpId: '', taskTitle: '', taskDescription: '', priority: 'Medium', workingHours: 8 }]);
  };

  const updateTask = (idx, field, value) => {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const removeTask = (idx) => setTasks(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectName.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);

    const serializedLinks = links
      .filter(l => l.name.trim() && l.url.trim())
      .map(l => `${l.name.trim()}|${l.url.trim()}`);

    const serializedDocLinks = docLinks
      .filter(l => l.name.trim() && l.url.trim())
      .map(l => `${l.name.trim()}|${l.url.trim()}`);

    // Validate tasks if any
    const validTasks = tasks.filter(t => t.taskTitle.trim() && t.assignedToEmpId);

    try {
      if (validTasks.length > 0) {
        // Use batch API
        await projectsApi.createProjectWithTasks({
          projectName: form.projectName.trim(),
          description: form.description.trim(),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          teamId: form.teamId ? parseInt(form.teamId) : null,
          links: serializedLinks.length > 0 ? serializedLinks : null,
          documentationLinks: serializedDocLinks.length > 0 ? serializedDocLinks : null,
          tasks: validTasks.map(t => ({
            assignedToEmpId: parseInt(t.assignedToEmpId),
            taskTitle: t.taskTitle.trim(),
            taskDescription: t.taskDescription?.trim() || '',
            priority: t.priority || 'Medium',
            workingHours: parseInt(t.workingHours) || 8,
          })),
        });
        toast.success(`✅ Project created with ${validTasks.length} task${validTasks.length > 1 ? 's' : ''}!`);
      } else {
        await projectsApi.createProject({
          projectName: form.projectName.trim(),
          description: form.description.trim(),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          teamId: form.teamId ? parseInt(form.teamId) : null,
          links: serializedLinks.length > 0 ? serializedLinks : null,
          documentationLinks: serializedDocLinks.length > 0 ? serializedDocLinks : null,
        });
        toast.success('✅ Project created!');
      }
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create New Project</h2>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Fill in the project details and optionally add tasks</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: '#fff' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div>
            <label style={labelStyle}>Project Name *</label>
            <input style={inputStyle} value={form.projectName} onChange={e => set('projectName', e.target.value)}
              placeholder="e.g. Customer Portal Redesign" required />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Brief project description..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" style={inputStyle} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>

          {/* Project Links */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Project Links</label>
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: '2px 8px', color: '#4F46E5' }}
                onClick={() => setLinks(prev => [...prev, { name: '', url: '' }])}>
                + Add Link
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map((link, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '6px 10px' }} value={link.name}
                    onChange={e => { const v = e.target.value; setLinks(p => p.map((l, i) => i === idx ? { ...l, name: v } : l)); }}
                    placeholder="e.g. GitHub" />
                  <input style={{ ...inputStyle, flex: 2, fontSize: 12, padding: '6px 10px' }} value={link.url}
                    onChange={e => { const v = e.target.value; setLinks(p => p.map((l, i) => i === idx ? { ...l, url: v } : l)); }}
                    placeholder="e.g. github.com/..." />
                  <button type="button" className="icon-btn" style={{ padding: 4 }}
                    onClick={() => setLinks(p => p.length > 1 ? p.filter((_, i) => i !== idx) : [{ name: '', url: '' }])}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9CA3AF' }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Documentation Links */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Documentation Links</label>
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: '2px 8px', color: '#4F46E5' }}
                onClick={() => setDocLinks(prev => [...prev, { name: '', url: '' }])}>
                + Add Doc Link
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docLinks.map((link, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '6px 10px' }} value={link.name}
                    onChange={e => { const v = e.target.value; setDocLinks(p => p.map((l, i) => i === idx ? { ...l, name: v } : l)); }}
                    placeholder="e.g. API Reference" />
                  <input style={{ ...inputStyle, flex: 2, fontSize: 12, padding: '6px 10px' }} value={link.url}
                    onChange={e => { const v = e.target.value; setDocLinks(p => p.map((l, i) => i === idx ? { ...l, url: v } : l)); }}
                    placeholder="e.g. docs.mycompany.com" />
                  <button type="button" className="icon-btn" style={{ padding: 4 }}
                    onClick={() => setDocLinks(p => p.length > 1 ? p.filter((_, i) => i !== idx) : [{ name: '', url: '' }])}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9CA3AF' }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Inline Task Creation ── */}
          <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>task_alt</span>
                  Tasks ({tasks.length})
                </label>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Optionally assign tasks now</p>
              </div>
              <button type="button" className="btn btn-sm" onClick={addTask}
                style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: 12, padding: '6px 12px', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 2 }}>add</span>
                Add Task
              </button>
            </div>
            {tasks.map((task, idx) => (
              <div key={idx} style={{
                padding: 14, borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 10,
                background: '#FAFAFA', position: 'relative',
              }}>
                <button type="button" onClick={() => removeTask(idx)} style={{
                  position: 'absolute', top: 8, right: 8, background: 'none', border: 'none',
                  cursor: 'pointer', color: '#EF4444', padding: 2,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Task Title *</label>
                    <input style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }} value={task.taskTitle}
                      onChange={e => updateTask(idx, 'taskTitle', e.target.value)} placeholder="e.g. Build login page" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Assign To *</label>
                    <select style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }} value={task.assignedToEmpId}
                      onChange={e => updateTask(idx, 'assignedToEmpId', e.target.value)}>
                      <option value="">— Select —</option>
                      {teamMembers.map(m => (
                        <option key={m.empId} value={m.empId}>
                          {m.name || m.email?.split('@')[0]} ({m.role}) — #{m.empId}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Priority</label>
                    <select style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }} value={task.priority}
                      onChange={e => updateTask(idx, 'priority', e.target.value)}>
                      <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Est. Hours</label>
                    <input type="number" style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }} value={task.workingHours}
                      onChange={e => updateTask(idx, 'workingHours', e.target.value)} min="1" />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 11 }}>Description</label>
                    <input style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }} value={task.taskDescription}
                      onChange={e => updateTask(idx, 'taskDescription', e.target.value)} placeholder="Optional" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 160 }}>
              {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Creating...</> : `Create Project${tasks.length > 0 ? ` + ${tasks.length} Task${tasks.length > 1 ? 's' : ''}` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


const formatDateString = (dt) => {
  if (!dt) return '';
  try {
    return new Date(dt).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

/* ─────────── Edit Project Modal ─────────── */
function EditProjectModal({ project, onClose, onUpdated }) {
  const [form, setForm] = useState({
    projectName: project.projectName || project.projectname || '',
    description: project.description || '',
    startDate: project.startDate || project.startdate ? formatDateString(project.startDate || project.startdate) : '',
    endDate: project.endDate || project.enddate ? formatDateString(project.endDate || project.enddate) : '',
    teamId: project.teamId || project.teamid || '',
    spaceId: project.spaceId || project.spaceid || '',
  });

  const [links, setLinks] = useState(() => {
    const raw = project.links || project.Links;
    if (raw && raw.length > 0) {
      return raw.map(parseLinkString).filter(Boolean);
    }
    return [{ name: '', url: '' }];
  });

  const [docLinks, setDocLinks] = useState(() => {
    const raw = project.documentationLinks || project.documentationlinks || project.DocumentationLinks;
    if (raw && raw.length > 0) {
      return raw.map(parseLinkString).filter(Boolean);
    }
    return [{ name: '', url: '' }];
  });

  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectName.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);

    const serializedLinks = links
      .filter(l => l.name.trim() && l.url.trim())
      .map(l => `${l.name.trim()}|${l.url.trim()}`);

    const serializedDocLinks = docLinks
      .filter(l => l.name.trim() && l.url.trim())
      .map(l => `${l.name.trim()}|${l.url.trim()}`);

    try {
      const payload = {
        projectName: form.projectName.trim(),
        description: form.description.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        teamId: form.teamId ? parseInt(form.teamId) : null,
        spaceId: form.spaceId ? parseInt(form.spaceId) : null,
        links: serializedLinks.length > 0 ? serializedLinks : null,
        documentationLinks: serializedDocLinks.length > 0 ? serializedDocLinks : null,
      };

      const pid = project.projectId || project.projectid;
      const res = await projectsApi.updateProject(pid, payload);
      toast.success('✅ Project updated successfully!');
      onUpdated(res.data.project || { ...project, ...payload });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Edit Project</h2>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Modify project configuration, description, and links</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: '#fff' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div>
            <label style={labelStyle}>Project Name *</label>
            <input style={inputStyle} value={form.projectName} onChange={e => set('projectName', e.target.value)}
              placeholder="e.g. Customer Portal Redesign" required />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Brief project description..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" style={inputStyle} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>

          {/* Project Links */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Project Links</label>
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: '2px 8px', color: '#4F46E5' }}
                onClick={() => setLinks(prev => [...prev, { name: '', url: '' }])}>
                + Add Link
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {links.map((link, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '6px 10px' }} value={link.name}
                    onChange={e => { const v = e.target.value; setLinks(p => p.map((l, i) => i === idx ? { ...l, name: v } : l)); }}
                    placeholder="e.g. GitHub" />
                  <input style={{ ...inputStyle, flex: 2, fontSize: 12, padding: '6px 10px' }} value={link.url}
                    onChange={e => { const v = e.target.value; setLinks(p => p.map((l, i) => i === idx ? { ...l, url: v } : l)); }}
                    placeholder="e.g. github.com/..." />
                  <button type="button" className="icon-btn" style={{ padding: 4 }}
                    onClick={() => setLinks(p => p.length > 1 ? p.filter((_, i) => i !== idx) : [{ name: '', url: '' }])}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9CA3AF' }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Documentation Links */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Documentation Links</label>
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: '2px 8px', color: '#4F46E5' }}
                onClick={() => setDocLinks(prev => [...prev, { name: '', url: '' }])}>
                + Add Doc Link
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docLinks.map((link, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '6px 10px' }} value={link.name}
                    onChange={e => { const v = e.target.value; setDocLinks(p => p.map((l, i) => i === idx ? { ...l, name: v } : l)); }}
                    placeholder="e.g. API Reference" />
                  <input style={{ ...inputStyle, flex: 2, fontSize: 12, padding: '6px 10px' }} value={link.url}
                    onChange={e => { const v = e.target.value; setDocLinks(p => p.map((l, i) => i === idx ? { ...l, url: v } : l)); }}
                    placeholder="e.g. docs.mycompany.com" />
                  <button type="button" className="icon-btn" style={{ padding: 4 }}
                    onClick={() => setDocLinks(p => p.length > 1 ? p.filter((_, i) => i !== idx) : [{ name: '', url: '' }])}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9CA3AF' }}>delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 120 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────── Assign Task Modal ─────────── */
function AssignTaskModal({ project, teamMembers, onClose, onAssigned }) {
  const [form, setForm] = useState({
    assignedToEmpId: '', taskTitle: '', taskDescription: '',
    taskStatus: 'Pending', priority: 'Medium',
    startDate: today(), dueDate: '', workingHours: '8',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.assignedToEmpId) { toast.error('Please select an employee'); return; }
    if (!form.taskTitle.trim()) { toast.error('Task title is required'); return; }
    setSaving(true);
    try {
      await projectsApi.assignTask({
        projectId: project.projectId || project.projectid,
        assignedToEmpId: parseInt(form.assignedToEmpId),
        taskTitle: form.taskTitle.trim(),
        taskDescription: form.taskDescription.trim(),
        taskStatus: form.taskStatus,
        priority: form.priority,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        workingHours: parseInt(form.workingHours) || 8,
      });
      toast.success('✅ Task assigned!');
      onAssigned();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Assign Task</h2>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              Project: <strong>{project.projectName || project.projectname}</strong>
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: '#fff' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div>
            <label style={labelStyle}>Assign To *</label>
            <select style={inputStyle} value={form.assignedToEmpId} onChange={e => set('assignedToEmpId', e.target.value)} required>
              <option value="">— Select Employee —</option>
              {teamMembers.map(m => (
                <option key={m.empId} value={m.empId}>
                  {m.name || m.email?.split('@')[0]} ({m.role}) — #{m.empId}
                </option>
              ))}
            </select>
            {teamMembers.length === 0 && (
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>No active team members found.</p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Task Title *</label>
            <input style={inputStyle} value={form.taskTitle} onChange={e => set('taskTitle', e.target.value)}
              placeholder="e.g. Build login component" required />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} value={form.taskDescription} onChange={e => set('taskDescription', e.target.value)}
              rows={3} placeholder="Task details, acceptance criteria..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.taskStatus} onChange={e => set('taskStatus', e.target.value)}>
                <option>Pending</option><option>Active</option><option>Resolve</option><option>Complete</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" style={inputStyle} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Est. Hours</label>
              <input type="number" style={inputStyle} value={form.workingHours} min="1" max="1000"
                onChange={e => set('workingHours', e.target.value)} placeholder="8" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Assigning...</> : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────── Edit Task Modal ─────────── */
function EditTaskModal({ task, teamMembers, onClose, onUpdated }) {
  const [form, setForm] = useState({
    assignedToEmpId: task.assignedToEmpId || task.assignedtoempid || '',
    taskTitle: task.taskTitle || task.tasktitle || '',
    taskDescription: task.taskDescription || task.taskdescription || '',
    taskStatus: task.taskStatus || task.taskstatus || 'Pending',
    priority: task.priority || task.Priority || 'Medium',
    startDate: task.startDate || task.startdate ? formatDateString(task.startDate || task.startdate) : today(),
    dueDate: task.dueDate || task.duedate ? formatDateString(task.dueDate || task.duedate) : '',
    workingHours: (task.workingHours || task.workinghours || '8').toString(),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.assignedToEmpId) { toast.error('Please select an employee'); return; }
    if (!form.taskTitle.trim()) { toast.error('Task title is required'); return; }
    setSaving(true);
    const tid = task.taskId || task.taskid;
    try {
      await projectsApi.updateTask(tid, {
        projectId: task.projectId || task.projectid,
        assignedToEmpId: parseInt(form.assignedToEmpId),
        taskTitle: form.taskTitle.trim(),
        taskDescription: form.taskDescription.trim(),
        taskStatus: form.taskStatus,
        priority: form.priority,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        workingHours: parseInt(form.workingHours) || 8,
      });
      toast.success('✅ Task updated successfully!');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Edit Task</h2>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              Update details for task: <strong>{task.taskTitle || task.tasktitle}</strong>
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: '#fff' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div>
            <label style={labelStyle}>Assign To *</label>
            <select style={inputStyle} value={form.assignedToEmpId} onChange={e => set('assignedToEmpId', e.target.value)} required>
              <option value="">— Select Employee —</option>
              {teamMembers.map(m => (
                <option key={m.empId} value={m.empId}>
                  {m.name || m.email?.split('@')[0]} ({m.role}) — #{m.empId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Task Title *</label>
            <input style={inputStyle} value={form.taskTitle} onChange={e => set('taskTitle', e.target.value)}
              placeholder="e.g. Build login component" required />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} value={form.taskDescription} onChange={e => set('taskDescription', e.target.value)}
              rows={3} placeholder="Task details, acceptance criteria..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.taskStatus} onChange={e => set('taskStatus', e.target.value)}>
                <option>Pending</option><option>Active</option><option>Resolve</option><option>Complete</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" style={inputStyle} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Est. Hours</label>
              <input type="number" style={inputStyle} value={form.workingHours} min="1" max="1000"
                onChange={e => set('workingHours', e.target.value)} placeholder="8" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Saving...</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────── Task Card ─────────── */
function TaskCard({ task, isMyTask, onStatusChange, canUpdateStatus, canManage, onEdit }) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const status = task.taskStatus || task.taskstatus || 'Pending';
  const priority = task.priority || task.Priority || 'Medium';
  const tid = task.taskId || task.taskid;
  const projectName = task.projectName || task.projectname;

  const cycleStatus = async () => {
    if (!canUpdateStatus || updatingStatus) return;
    const next = {
      'Pending': 'Active',
      'Active': 'Resolve',
      'Resolve': 'Complete',
      'Complete': 'Pending',
      'InProgress': 'Active',
      'Completed': 'Complete',
      'In Progress': 'Active'
    };
    const newStatus = next[status] || 'Pending';
    setUpdatingStatus(true);
    try {
      await projectsApi.updateTaskStatus(tid, newStatus);
      onStatusChange(tid, newStatus);
      toast.success(`Task marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div style={{
      padding: 14, borderRadius: 10,
      border: isMyTask ? '2px solid #4F46E540' : '1px solid var(--gray-100)',
      background: isMyTask ? '#EEF2FF30' : 'var(--surface)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{task.taskTitle || task.tasktitle}</span>
            {isMyTask && (
              <span style={{ fontSize: 10, fontWeight: 700, background: '#4F46E5', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>MINE</span>
            )}
          </div>
          {projectName && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, marginBottom: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>folder</span>
              {projectName}
            </div>
          )}
          {(task.taskDescription || task.taskdescription) && (
            <p style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.4 }}>
              {task.taskDescription || task.taskdescription}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          {canManage && onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="btn btn-sm"
              style={{ padding: '2px 6px', background: '#4F46E515', color: '#4F46E5', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
              title="Edit Task"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            </button>
          )}
          <button
            onClick={cycleStatus}
            disabled={!canUpdateStatus || updatingStatus}
            style={{ cursor: canUpdateStatus ? 'pointer' : 'default', background: 'none', border: 'none', padding: 0 }}
            title={canUpdateStatus ? 'Click to update status' : ''}
          >
            <StatusBadge status={status} />
          </button>
          <PriorityBadge priority={priority} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(task.dueDate || task.duedate) && (
          <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
            📅 Due: {new Date(task.dueDate || task.duedate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
        {(task.workingHours || task.workinghours) && (
          <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
            ⏱ {task.workingHours || task.workinghours}h estimated
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────── Main ProjectsPage ─────────── */
export default function ProjectsPage() {
  const { user } = useAuth();
  const role = user?.role || 'Employee';
  const isTL = role === 'TeamLead';
  const isManager = role === 'Manager';
  const isAdmin = role === 'Admin';
  const canManage = isTL || isAdmin;

  const [tab, setTab] = useState('myProjects');
  const [projects, setProjects] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [allAssignedTasks, setAllAssignedTasks] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(null);
  const [showEditProject, setShowEditProject] = useState(null);
  const [showEditTask, setShowEditTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFiles, setProjectFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['xls', 'xlsx'].includes(ext)) return 'table_chart';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['ppt', 'pptx'].includes(ext)) return 'slideshow';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
    if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip';
    return 'attachment';
  };

  const loadProjectFiles = async (projectId) => {
    try {
      const rf = await projectsApi.getProjectFiles(projectId);
      setProjectFiles(rf.data || []);
    } catch (err) {
      console.warn('Failed to load project files silently', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedProject) return;

    const pid = selectedProject.projectId || selectedProject.projectid;
    const formData = new FormData();
    formData.append('file', file);

    setUploadingFile(true);
    try {
      await projectsApi.uploadProjectFile(pid, formData);
      toast.success('✅ File uploaded successfully!');
      await loadProjectFiles(pid);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleFileDelete = async (fileId) => {
    if (!selectedProject) return;
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    const pid = selectedProject.projectId || selectedProject.projectid;
    try {
      await projectsApi.deleteProjectFile(pid, fileId);
      toast.success('✅ File deleted successfully!');
      await loadProjectFiles(pid);
    } catch (err) {
      toast.error('Failed to delete file');
    }
  };

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const r = await projectsApi.getProjects();
      setProjects(r.data || []);
    } catch (err) {
      console.warn('Failed to load projects silently', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMyTasks = useCallback(async () => {
    try {
      const r = await projectsApi.getMyTasks();
      console.log('[ProjectsPage] MY TASKS:', r.data);
      setMyTasks(r.data || []);
    } catch (err) {
      console.error('[ProjectsPage] loadMyTasks error:', err);
    }
  }, []);

  const loadAllAssignedTasks = useCallback(async (search = '') => {
    if (!canManage) return;
    setLoadingAssigned(true);
    try {
      const r = await projectsApi.getAllAssignedTasks(search);
      console.log('[ProjectsPage] ALL ASSIGNED TASKS:', r.data);
      setAllAssignedTasks(r.data || []);
    } catch (err) {
      console.error('[ProjectsPage] loadAllAssignedTasks error:', err);
    } finally {
      setLoadingAssigned(false);
    }
  }, [canManage]);

  const loadTeamMembers = useCallback(async () => {
    if (!canManage && !isManager) return;
    try {
      const r = await teamApi.getTeamMembers();
      const members = (r.data || []).filter(m =>
        m.status?.toLowerCase() === 'active' &&
        (m.role || '').toLowerCase() !== 'admin' &&
        (m.role || '').toLowerCase() !== 'superadmin'
      );
      setTeamMembers(members);
    } catch { }
  }, [canManage, isManager]);

  useEffect(() => {
    loadProjects();
    loadMyTasks();
    loadTeamMembers();
  }, [loadProjects, loadMyTasks, loadTeamMembers]);

  // Load assigned tasks when switching to that tab
  useEffect(() => {
    if (tab === 'allTasks') {
      loadAllAssignedTasks(searchQuery);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    loadAllAssignedTasks(searchQuery);
  };

  const handleOpenProject = async (project) => {
    const pid = project.projectId || project.projectid;
    setSelectedProject(project);
    setLoadingTasks(true);
    setLoadingFiles(true);
    try {
      const r = await projectsApi.getTasks(pid);
      setProjectTasks(r.data || []);
    } catch (err) {
      console.warn('Failed to load tasks silently', err);
      setProjectTasks([]);
    } finally {
      setLoadingTasks(false);
    }

    try {
      const rf = await projectsApi.getProjectFiles(pid);
      setProjectFiles(rf.data || []);
    } catch (err) {
      console.warn('Failed to load project files silently', err);
      setProjectFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleTaskStatusChange = (taskId, newStatus) => {
    setProjectTasks(prev => prev.map(t =>
      (t.taskId || t.taskid) === taskId ? { ...t, taskStatus: newStatus, taskstatus: newStatus } : t
    ));
    setMyTasks(prev => prev.map(t =>
      (t.taskId || t.taskid) === taskId ? { ...t, taskStatus: newStatus, taskstatus: newStatus } : t
    ));
    setAllAssignedTasks(prev => prev.map(t =>
      (t.taskId || t.taskid) === taskId ? { ...t, taskStatus: newStatus, taskstatus: newStatus } : t
    ));
  };

  const myTaskIds = new Set(myTasks.map(t => t.taskId || t.taskid));

  /* Tab Selector */
  function TabBar() {
    const tabs = canManage
      ? [
        { id: 'myProjects', label: 'Company Projects', icon: 'folder' },
        { id: 'allTasks', label: 'All Assigned Tasks', icon: 'task_alt' },
        { id: 'myWork', label: 'My Work', icon: 'person' },
      ]
      : isManager
        ? [
          { id: 'myProjects', label: 'Company Projects', icon: 'folder' },
          { id: 'myWork', label: 'My Assigned Tasks', icon: 'person' },
        ]
        : [
          { id: 'myProjects', label: 'Company Projects', icon: 'folder' },
          { id: 'myWork', label: 'My Tasks', icon: 'task_alt' },
        ];

    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--gray-100)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedProject(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: tab === t.id ? 'var(--primary-600)' : 'var(--gray-500)',
              borderBottom: tab === t.id ? '2px solid var(--primary-500)' : '2px solid transparent',
              marginBottom: -1, transition: 'all .2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
            {t.id === 'allTasks' && allAssignedTasks.length > 0 && (
              <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, background: '#4F46E5', color: '#fff', borderRadius: 99, padding: '1px 6px' }}>
                {allAssignedTasks.length}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  /* Project Card */
  function ProjectCard({ project }) {
    const pid = project.projectId || project.projectid;
    const isSelected = (selectedProject?.projectId || selectedProject?.projectid) === pid;
    return (
      <div
        className="card"
        style={{ cursor: 'pointer', border: isSelected ? '2px solid var(--primary-500)' : '2px solid transparent', transition: 'all .2s' }}
        onClick={() => handleOpenProject(project)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>folder_open</span>
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{project.projectName || project.projectname}</h4>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                {project.startDate || project.startdate
                  ? `Started ${new Date(project.startDate || project.startdate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : 'Ongoing'}
                {(project.endDate || project.enddate) && ` · Due ${new Date(project.endDate || project.enddate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {canManage && (
              <>
                <button
                  className="btn btn-sm"
                  style={{ background: '#4F46E520', color: '#4F46E5', fontSize: 11, padding: '4px 10px' }}
                  onClick={e => { e.stopPropagation(); setShowAssignTask(project); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_task</span>
                  Assign Task
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: '#10B98120', color: '#10B981', fontSize: 11, padding: '4px 10px' }}
                  onClick={e => { e.stopPropagation(); setShowEditProject(project); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
        {(project.description) && (
          <p style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.5, marginBottom: 8 }}>
            {project.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <AppLayout role={isAdmin ? 'admin' : 'employee'}>
      <div className="page-content fade-in">
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
              {canManage ? 'Project Management' : 'My Projects'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              {canManage
                ? 'Create projects, assign tasks to your team members'
                : isManager
                  ? 'View all projects and team progress (read-only)'
                  : 'Projects assigned to you and your tasks'}
            </p>
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowCreateProject(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              New Project
            </button>
          )}
        </div>

        <TabBar />

        {/* ── TAB: My Projects / All Projects ── */}
        {tab === 'myProjects' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedProject ? '340px 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
            <div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card" style={{ height: 110, animation: 'pulse 1.5s infinite', background: 'var(--gray-50)' }} />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>folder_off</span>
                  <p style={{ fontWeight: 600 }}>No projects yet</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>
                    {canManage ? 'Click "New Project" to create your first project' : 'Projects will appear here once assigned'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {projects.map(p => <ProjectCard key={p.projectId || p.projectid} project={p} />)}
                </div>
              )}
            </div>

            {/* Task panel */}
            {selectedProject && (
              <div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedProject.projectName || selectedProject.projectname}</h3>
                      <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
                        {selectedProject.description || 'No description available'}
                      </p>
                      {renderLinksSection(selectedProject.links || selectedProject.Links, 'Project Links', 'link') || (
                        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>No link provided</p>
                      )}
                      {renderLinksSection(selectedProject.documentationLinks || selectedProject.documentationlinks || selectedProject.DocumentationLinks, 'Documentation Links', 'description')}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedProject(null)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </div>
                </div>

                {/* ── Project Files Widget ── */}
                <div className="card" style={{ marginBottom: 16, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-100)', paddingBottom: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-500)', fontSize: 20 }}>folder_open</span>
                      <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Project Documents & Assets</h4>
                    </div>
                    {canManage && (
                      <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer', fontSize: 12, color: 'var(--primary-600)', background: 'var(--primary-50)', padding: '4px 10px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                        {uploadingFile ? 'Uploading...' : 'Upload File'}
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>

                  {loadingFiles ? (
                    <div style={{ padding: 12, textAlign: 'center' }}>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: '0 auto 8px' }} />
                      <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Loading files...</span>
                    </div>
                  ) : projectFiles.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: 0, textAlign: 'center', padding: '10px 0' }}>
                      No project files uploaded yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {projectFiles.map(file => (
                        <div
                          key={file.fileId || file.fileid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#F9FAFB',
                            border: '1px solid #E5E7EB',
                            borderRadius: 8,
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--gray-500)', fontSize: 20 }}>
                              {getFileIcon(file.fileName || file.filename)}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--gray-700)',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '220px',
                                }}
                                title={file.fileName || file.filename}
                              >
                                {file.fileName || file.filename}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>
                                {new Date(file.uploadedAt || file.uploadedat).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 4 }}>
                            <a
                              href={`${BACKEND_ORIGIN}${file.filePath || file.filepath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{
                                padding: '3px 6px',
                                background: '#10B98115',
                                color: '#10B981',
                                border: 'none',
                                borderRadius: 4,
                                textDecoration: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Download File"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                            </a>
                            {canManage && (
                              <button
                                onClick={() => handleFileDelete(file.fileId || file.fileid)}
                                className="btn btn-sm"
                                style={{
                                  padding: '3px 6px',
                                  background: '#EF444415',
                                  color: '#EF4444',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                                title="Delete File"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700 }}>Tasks ({projectTasks.length})</h4>
                    {canManage && (
                      <button className="btn btn-sm btn-primary" onClick={() => setShowAssignTask(selectedProject)} style={{ fontSize: 11 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_task</span>
                        Assign Task
                      </button>
                    )}
                  </div>

                  {loadingTasks ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <div className="spinner" style={{ margin: '0 auto 12px' }} />
                      <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Loading tasks...</span>
                    </div>
                  ) : projectTasks.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 10 }}>task_alt</span>
                      No tasks yet.{canManage ? ' Click "Assign Task" to add one.' : ''}
                    </div>
                  ) : (
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {projectTasks.map(task => (
                        <TaskCard
                          key={task.taskId || task.taskid}
                          task={task}
                          isMyTask={myTaskIds.has(task.taskId || task.taskid)}
                          onStatusChange={handleTaskStatusChange}
                          canUpdateStatus={myTaskIds.has(task.taskId || task.taskid) || canManage}
                          canManage={canManage}
                          onEdit={setShowEditTask}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: All Assigned Tasks (TL/Admin) ── */}
        {tab === 'allTasks' && (
          <div>
            {/* Search Bar */}
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span className="material-symbols-outlined" style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 18, color: '#9CA3AF', pointerEvents: 'none',
                }}>search</span>
                <input
                  style={{ ...inputStyle, paddingLeft: 38 }}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by task title or project name..."
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
                Search
              </button>
              {searchQuery && (
                <button type="button" className="btn btn-ghost" onClick={() => { setSearchQuery(''); loadAllAssignedTasks(''); }}>
                  Clear
                </button>
              )}
            </form>

            <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 16 }}>
              {searchQuery
                ? `Showing results for "${searchQuery}" — ${allAssignedTasks.length} task${allAssignedTasks.length !== 1 ? 's' : ''} found`
                : `All tasks you've assigned across your projects. Click a task's status badge to update it.`}
            </p>

            {loadingAssigned ? (
              <div className="card" style={{ height: 200, animation: 'pulse 1.5s infinite', background: 'var(--gray-50)' }} />
            ) : allAssignedTasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>inbox</span>
                <p style={{ fontWeight: 600 }}>{searchQuery ? 'No tasks match your search' : 'No tasks assigned yet'}</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  {searchQuery ? 'Try a different search term' : 'Use "Assign Task" on a project to create tasks'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {allAssignedTasks.map(task => (
                  <TaskCard
                    key={task.taskId || task.taskid}
                    task={task}
                    isMyTask={myTaskIds.has(task.taskId || task.taskid)}
                    onStatusChange={handleTaskStatusChange}
                    canUpdateStatus={true}
                    canManage={canManage}
                    onEdit={setShowEditTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: My Own Work ── */}
        {tab === 'myWork' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 16 }}>
              Tasks assigned to you. Click a status badge to update progress.
            </p>
            {myTasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>task_alt</span>
                <p style={{ fontWeight: 600 }}>No tasks assigned to you</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myTasks.map(task => (
                  <TaskCard
                    key={task.taskId || task.taskid}
                    task={task}
                    isMyTask={true}
                    onStatusChange={handleTaskStatusChange}
                    canUpdateStatus={true}
                    canManage={false}
                    onEdit={null}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreated={() => { loadProjects(); loadAllAssignedTasks(); }}
          teamMembers={teamMembers}
        />
      )}
      {showAssignTask && (
        <AssignTaskModal
          project={showAssignTask}
          teamMembers={teamMembers}
          onClose={() => setShowAssignTask(null)}
          onAssigned={() => {
            loadMyTasks();
            loadAllAssignedTasks(searchQuery);
            if (selectedProject && (selectedProject.projectId || selectedProject.projectid) === (showAssignTask.projectId || showAssignTask.projectid)) {
              handleOpenProject(showAssignTask);
            }
          }}
        />
      )}
      {showEditProject && (
        <EditProjectModal
          project={showEditProject}
          onClose={() => setShowEditProject(null)}
          onUpdated={(updatedProj) => {
            loadProjects();
            if (selectedProject && (selectedProject.projectId || selectedProject.projectid) === (updatedProj.projectId || updatedProj.projectid)) {
              setSelectedProject(updatedProj);
            }
          }}
        />
      )}
      {showEditTask && (
        <EditTaskModal
          task={showEditTask}
          teamMembers={teamMembers}
          onClose={() => setShowEditTask(null)}
          onUpdated={() => {
            loadMyTasks();
            loadAllAssignedTasks(searchQuery);
            if (selectedProject) {
              handleOpenProject(selectedProject);
            }
          }}
        />
      )}
    </AppLayout>
  );
}
