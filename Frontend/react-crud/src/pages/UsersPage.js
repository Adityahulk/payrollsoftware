import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ProfileDrawer from '../components/ProfileDrawer';
import { usersApi, spacesApi, wfhApi, incentivesApi } from '../api/index';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal"><span className="material-symbols-outlined">close</span></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [warnModal, setWarnModal] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Employee', spaceId: '', password: '' });
  const [editUser, setEditUser] = useState({ name: '', email: '', role: 'Employee', spaceId: '' });
  const [spaces, setSpaces] = useState([]);
  const [warnReason, setWarnReason] = useState('');
  const [profileDrawerEmpId, setProfileDrawerEmpId] = useState(null);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  // Incentive States
  const [incentiveModal, setIncentiveModal] = useState(null);
  const [incentiveAmount, setIncentiveAmount] = useState('');
  const [incentiveType, setIncentiveType] = useState('Performance');
  const [incentiveReason, setIncentiveReason] = useState('');
  const [incentiveMonth, setIncentiveMonth] = useState(new Date().getMonth() + 1);
  const [incentiveYear, setIncentiveYear] = useState(new Date().getFullYear());

  // WFH States
  const [wfhModal, setWfhModal] = useState(null);
  const [wfhList, setWfhList] = useState([]);
  const [loadingWfh, setLoadingWfh] = useState(false);
  const [wfhDate, setWfhDate] = useState(new Date().toISOString().split('T')[0]);
  const searchTimer = useRef(null);

  // Dynamic labels based on role
  const isAdmin = currentUser?.role === 'Admin';
  const pageTitle = isAdmin ? 'Employee Management' : 'Team Members';
  const pageSubtitle = isAdmin
    ? 'Manage all employees across your company'
    : 'View and manage your team';

  const formatUserData = (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(u => ({
      ...u,
      name: u.name || (u.email ? u.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown')
    }));
  };

  // Role-conditional API: Admin → GET /api/User (full list)
  // Manager/TL/Employee → GET /api/User/company (company-scoped, read-only)
  const fetchUsers = useCallback((signal) => {
    if (isAdmin) {
      return usersApi.getUsers(signal);
    }
    return usersApi.getCompanyUsers(signal);
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    fetchUsers(controller.signal)
      .then(r => {
        const data = r.data;
        if (!data || data.length === 0) {
          setUsers([]);
        } else {
          setUsers(formatUserData(data));
        }
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchUsers]);

  useEffect(() => {
    if (isAdmin) {
      const loadSpaces = async () => {
        try {
          const r = await spacesApi.getMySpaces();
          const fetchedSpaces = r.data || [];
          if (fetchedSpaces.length > 0) {
            setSpaces(fetchedSpaces);
            const firstId = fetchedSpaces[0].spaceId ?? fetchedSpaces[0].spaceid ?? fetchedSpaces[0].SpaceId;
            if (firstId) setNewUser(p => ({ ...p, spaceId: firstId.toString() }));
            return;
          }
        } catch (err) {
          console.error("Failed to load spaces via /spaces/my", err);
        }

        // Resilient Fallback: try loading by Admin's ID directly if context is available
        if (currentUser?.empId) {
          try {
            const fallbackRes = await spacesApi.getSpacesByAdmin(currentUser.empId);
            const fallbackSpaces = fallbackRes.data || [];
            if (fallbackSpaces.length > 0) {
              setSpaces(fallbackSpaces);
              const firstId = fallbackSpaces[0].spaceId ?? fallbackSpaces[0].spaceid ?? fallbackSpaces[0].SpaceId;
              if (firstId) setNewUser(p => ({ ...p, spaceId: firstId.toString() }));
              return;
            }
          } catch (err) {
            console.error("Failed fallback spaces resolution", err);
          }
        }
        setSpaces([]);
      };
      loadSpaces();
    }
  }, [isAdmin, currentUser]);

  const handleSearch = useCallback((e) => {
    clearTimeout(searchTimer.current);
    const q = e.target.value;
    searchTimer.current = setTimeout(() => {
      if (q.trim().length >= 2) {
        // Search: Admin uses server-side search; others filter client-side
        if (isAdmin) {
          usersApi.searchUsers(q).then(r => setUsers(formatUserData(r.data || []))).catch(() => { });
        } else {
          // For non-admin, filtering is done client-side via the `filtered` memo below
        }
      } else if (q.trim() === '') {
        fetchUsers().then(r => {
          const data = r.data;
          setUsers(!data || data.length === 0 ? [] : formatUserData(data));
        }).catch(() => setUsers([]));
      }
      setSearchQuery(q);
    }, 300);
  }, [isAdmin, fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.spaceId) {
      toast.error('Please select a workspace!');
      return;
    }
    if (!newUser.password || newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters long!');
      return;
    }
    const user = { ...newUser, empId: Date.now(), status: 'active' };
    setUsers(prev => [...prev, user]);
    try {
      await usersApi.createUser({ ...newUser, spaceId: parseInt(newUser.spaceId) });
      toast.success('Employee added!');
      // Reload using role-correct API
      fetchUsers().then(r => {
        const data = r.data;
        setUsers(!data || data.length === 0 ? [] : formatUserData(data));
      }).catch(() => setUsers([]));
    } catch { toast.error('Failed to add employee.'); setUsers(prev => prev.filter(u => u.empId !== user.empId)); }
    setAddModal(false);
    setNewUser({ name: '', email: '', role: 'Employee', spaceId: '', password: '' });
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...editModal,
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        spaceId: parseInt(editUser.spaceId)
      };
      await usersApi.updateUser(editModal.empId, payload);
      toast.success('Employee updated!');
      // Reload using role-correct API
      fetchUsers().then(r => {
        const data = r.data;
        setUsers(!data || data.length === 0 ? [] : formatUserData(data));
      }).catch(() => setUsers([]));
    } catch {
      toast.error('Failed to update employee.');
    }
    setEditModal(null);
  };

  const handleWarn = async () => {
    if (!warnReason.trim()) { toast.error('Enter a reason'); return; }
    try {
      await usersApi.issueWarning(warnModal.empId, warnReason);
      toast.success(`Warning issued to ${warnModal.name}`);
    } catch { toast.error('Failed to issue warning.'); }
    setWarnModal(null);
    setWarnReason('');
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (newStatus === 'Inactive' && !statusReason.trim()) {
      toast.error('Enter a reason for making the user inactive');
      return;
    }
    setUsers(prev => prev.map(u => u.empId === statusModal.empId ? { ...u, status: newStatus } : u));
    try {
      await usersApi.updateStatus(statusModal.empId, newStatus, newStatus === 'Inactive' ? statusReason : '');
      toast.success('Employee status updated.');
    } catch {
      toast.error('Action failed.');
      // Reload using role-correct API on failure to revert optimistic update
      fetchUsers().then(r => {
        const data = r.data;
        setUsers(!data || data.length === 0 ? [] : formatUserData(data));
      }).catch(() => setUsers([]));
    }
    setStatusModal(null);
    setStatusReason('');
  };

  // WFH Handlers
  const loadWfhPermissions = useCallback(async () => {
    setLoadingWfh(true);
    try {
      const res = await wfhApi.getWfhPermissions();
      setWfhList(res.data || []);
    } catch (err) {
      console.error("Failed to load WFH permits", err);
      toast.error("Failed to load WFH permissions.");
    } finally {
      setLoadingWfh(false);
    }
  }, []);

  useEffect(() => {
    if (wfhModal) {
      loadWfhPermissions();
    }
  }, [wfhModal, loadWfhPermissions]);

  const handleGrantWfh = async (e) => {
    e.preventDefault();
    if (!wfhDate) {
      toast.error("Please select a date!");
      return;
    }
    try {
      await wfhApi.grantWfh(wfhModal.empId, wfhDate);
      toast.success("WFH permit granted!");
      loadWfhPermissions();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to grant WFH permit.";
      toast.error(msg);
    }
  };

  const handleRevokeWfh = async (dateStr) => {
    if (!window.confirm("Are you sure you want to revoke this WFH permit?")) return;
    try {
      await wfhApi.revokeWfh(wfhModal.empId, dateStr);
      toast.success("WFH permit revoked!");
      loadWfhPermissions();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to revoke WFH permit.";
      toast.error(msg);
    }
  };

  const handleAddIncentive = async (e) => {
    e.preventDefault();
    if (!incentiveAmount || parseFloat(incentiveAmount) <= 0) {
      toast.error('Incentive amount must be greater than zero.');
      return;
    }
    try {
      await incentivesApi.addIncentive({
        empId: incentiveModal.empId,
        amount: parseFloat(incentiveAmount),
        type: incentiveType,
        reason: incentiveReason,
        month: parseInt(incentiveMonth),
        year: parseInt(incentiveYear)
      });
      toast.success(`Incentive of ₹${incentiveAmount} added for ${incentiveModal.name}`);
      setIncentiveModal(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to add incentive.');
    }
  };

  const filtered = users.filter(u =>
    (!filterRole || u.role === filterRole) &&
    (!searchQuery || u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const ROLE_BADGE = { Admin: 'badge-error', TeamLead: 'badge-warning', Employee: 'badge-primary', Manager: 'badge-success' };

  const getStatusBadge = (status) => {
    const s = (status || 'Active').toLowerCase();
    if (s === 'active') return 'badge-success';
    if (s === 'pending') return 'badge-warning';
    return 'badge-error';
  };

  const displayStatus = (status) => {
    const s = (status || 'Active').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <AppLayout role="admin">
      <div className="page-content fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{pageTitle}</h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              {filtered.length} of {users.length} employees · {pageSubtitle}
            </p>
          </div>
          {currentUser?.role === 'Admin' && (
            <button className="btn btn-primary" onClick={() => setAddModal(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
              Add Employee
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--gray-400)' }}>search</span>
            <input placeholder="Search by name or email..." onChange={handleSearch} aria-label="Search employees" style={{ width: '100%' }} />
          </div>
          <select className="form-select" value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ width: 160 }} aria-label="Filter by role">
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="TeamLead">Team Lead</option>
            <option value="Manager">Manager</option>
            <option value="Employee">Employee</option>
          </select>
        </div>

        {/* Stats strip */}
        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: 'Total', value: users.length, color: '#4F46E5' },
            { label: 'Active', value: users.filter(u => u.status !== 'inactive').length, color: '#10B981' },
            { label: 'Team Leads', value: users.filter(u => u.role === 'TeamLead').length, color: '#F59E0B' },
            { label: 'Admins', value: users.filter(u => u.role === 'Admin').length, color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Role</th><th>Space ID</th><th>Status</th><th>Actions</th>
                </tr>
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
                      <td><div className="skeleton animate-pulse" style={{ width: 80, height: 24, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>No employees available in this space 🚫</td></tr>
                ) : filtered.map(emp => (
                  <tr key={emp.empId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar">{(emp.name || emp.email || 'U')[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${ROLE_BADGE[emp.role] || 'badge-gray'}`}>{emp.role}</span></td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--gray-500)' }}>#{emp.spaceId}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(emp.status)}`}>
                        {displayStatus(emp.status)}
                      </span>
                    </td>
                    <td>
                      {currentUser?.role === 'Admin' ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="icon-btn" title="Edit" aria-label="Edit employee" onClick={() => { setEditModal(emp); setEditUser({ name: emp.name || '', email: emp.email || '', role: emp.role || 'Employee', spaceId: emp.spaceId || '' }); }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span></button>
                          <button className="icon-btn" title="Warn" aria-label="Issue warning" onClick={() => setWarnModal(emp)} style={{ color: 'var(--warning)' }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span></button>
                          <button className="icon-btn" title="Change Status" aria-label="Change employee status" onClick={() => { setStatusModal(emp); setNewStatus(displayStatus(emp.status)); setStatusReason(''); }} style={{ color: 'var(--primary-600)' }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_accounts</span></button>
                          <button
                            className="icon-btn"
                            title="View Full Profile"
                            aria-label="View employee full profile"
                            onClick={() => { setProfileDrawerEmpId(emp.empId); setProfileDrawerOpen(true); }}
                            style={{ color: '#10B981', background: '#D1FAE5', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                          </button>
                          <button
                            className="icon-btn"
                            title="Add Incentive"
                            aria-label="Add Incentive"
                            onClick={() => {
                              setIncentiveModal(emp);
                              setIncentiveAmount('');
                              setIncentiveType('Performance');
                              setIncentiveReason('');
                              setIncentiveMonth(new Date().getMonth() + 1);
                              setIncentiveYear(new Date().getFullYear());
                            }}
                            style={{ color: '#059669', background: '#D1FAE5', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>payments</span>
                          </button>
                          {emp.role !== 'Admin' && emp.role !== 'SuperAdmin' && (
                            <>
                              <button
                                className="icon-btn"
                                title="Monitor Live Screen"
                                aria-label="Monitor employee screen live"
                                onClick={() => navigate('/admin/live-monitoring')}
                                style={{ color: '#6366F1', background: '#EEF2F6', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>monitor</span>
                              </button>
                              <button
                                className="icon-btn"
                                title="Manage WFH Permits"
                                aria-label="Manage WFH permits"
                                onClick={() => setWfhModal(emp)}
                                style={{ color: '#F59E0B', background: '#FEF3C7', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>home_work</span>
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--gray-400)', fontSize: 12, fontWeight: 500 }}>Read Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile cards */}
            <div className="mobile-cards">
              {filtered.map(emp => (
                <div key={emp.empId} className="card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="avatar">{(emp.name || 'U')[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{emp.email}</div>
                      </div>
                    </div>
                    <span className={`badge ${ROLE_BADGE[emp.role] || 'badge-gray'}`}>{emp.role}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${getStatusBadge(emp.status)}`}>{displayStatus(emp.status)}</span>
                    {currentUser?.role === 'Admin' ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="icon-btn" aria-label="Warn" onClick={() => setWarnModal(emp)} style={{ color: 'var(--warning)' }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span></button>
                        <button className="icon-btn" aria-label="Change Status" onClick={() => { setStatusModal(emp); setNewStatus(displayStatus(emp.status)); setStatusReason(''); }} style={{ color: 'var(--primary-600)' }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_accounts</span></button>
                        <button
                          className="icon-btn"
                          title="Add Incentive"
                          onClick={() => {
                            setIncentiveModal(emp);
                            setIncentiveAmount('');
                            setIncentiveType('Performance');
                            setIncentiveReason('');
                            setIncentiveMonth(new Date().getMonth() + 1);
                            setIncentiveYear(new Date().getFullYear());
                          }}
                          style={{ color: '#059669' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>payments</span>
                        </button>
                        {emp.role !== 'Admin' && emp.role !== 'SuperAdmin' && (
                          <>
                            <button className="icon-btn" aria-label="Monitor Live Screen" onClick={() => navigate('/admin/live-monitoring')} style={{ color: '#6366F1' }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>monitor</span></button>
                            <button className="icon-btn" aria-label="Manage WFH Permits" onClick={() => setWfhModal(emp)} style={{ color: '#F59E0B' }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>home_work</span></button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--gray-400)', fontSize: 12, fontWeight: 500 }}>Read Only</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add Employee Modal */}
        {addModal && (
          <Modal title="Add New Employee" onClose={() => setAddModal(false)}>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                {[['name', 'Full Name', 'text', 'John Doe'], ['email', 'Email', 'email', 'john@company.com']].map(([field, label, type, ph]) => (
                  <div key={field} className="form-group">
                    <label className="form-label">{label} *</label>
                    <input type={type} className="form-input" placeholder={ph} required value={newUser[field]} onChange={e => setNewUser(p => ({ ...p, [field]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={newUser.password || ''}
                    onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-select" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                    <option value="Employee">Employee</option>
                    <option value="TeamLead">Team Lead</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Workspace *</label>
                  <select
                    className="form-select"
                    required
                    value={newUser.spaceId}
                    onChange={e => setNewUser(p => ({ ...p, spaceId: e.target.value }))}
                  >
                    <option value="">Select Workspace</option>
                    {spaces.map(s => {
                      const spId = s.spaceId ?? s.spaceid ?? s.SpaceId;
                      const spName = s.spaceName ?? s.spacename ?? s.SpaceName;
                      return (
                        <option key={spId} value={spId}>
                          {spName} (ID: {spId})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>Add Employee</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Employee Modal */}
        {editModal && (
          <Modal title={`Edit Employee: ${editModal.name}`} onClose={() => setEditModal(null)}>
            <form onSubmit={handleEditUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-input" required value={editUser.name} onChange={e => setEditUser(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-input" required value={editUser.email} onChange={e => setEditUser(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-select" value={editUser.role} onChange={e => setEditUser(p => ({ ...p, role: e.target.value }))}>
                    <option value="Employee">Employee</option>
                    <option value="TeamLead">Team Lead</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Workspace *</label>
                  <select
                    className="form-select"
                    required
                    value={editUser.spaceId}
                    onChange={e => setEditUser(p => ({ ...p, spaceId: e.target.value }))}
                  >
                    <option value="">Select Workspace</option>
                    {spaces.map(s => {
                      const spId = s.spaceId ?? s.spaceid ?? s.SpaceId;
                      const spName = s.spaceName ?? s.spacename ?? s.SpaceName;
                      return (
                        <option key={spId} value={spId}>
                          {spName} (ID: {spId})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>Save Changes</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Warning Modal */}
        {warnModal && (
          <Modal title={`Issue Warning to ${warnModal.name}`} onClose={() => setWarnModal(null)}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-input" rows={4} placeholder="Describe the reason for this warning..." value={warnReason} onChange={e => setWarnReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setWarnModal(null)}>Cancel</button>
              <button className="btn btn-warning" onClick={handleWarn}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>Issue Warning</button>
            </div>
          </Modal>
        )}

        {/* Status Update Modal */}
        {statusModal && (
          <Modal title={`Update Status for ${statusModal.name}`} onClose={() => setStatusModal(null)}>
            <form onSubmit={handleUpdateStatus}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Status *</label>
                  <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                {newStatus === 'Inactive' && (
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">Reason for Inactive Status *</label>
                    <textarea className="form-input" rows={3} placeholder="Please provide a reason..." value={statusReason} onChange={e => setStatusReason(e.target.value)} required />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStatusModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>Save Status</button>
              </div>
            </form>
          </Modal>
        )}

        {/* WFH Management Modal */}
        {wfhModal && (
          <Modal title={`Manage WFH Permits: ${wfhModal.name}`} onClose={() => setWfhModal(null)}>
            <div className="modal-body">
              <form onSubmit={handleGrantWfh} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Grant WFH for Date</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={wfhDate}
                    onChange={e => setWfhDate(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: 38, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  Grant
                </button>
              </form>

              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--gray-700)' }}>Active WFH Permits</h4>
              {loadingWfh ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div className="spinner" style={{ width: 20, height: 20 }} />
                </div>
              ) : wfhList.filter(w => (w.empId ?? w.empid) === wfhModal.empId).length === 0 ? (
                <p style={{ color: 'var(--gray-500)', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>
                  No WFH permits active for this employee.
                </p>
              ) : (
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 8 }}>
                  {wfhList
                    .filter(w => (w.empId ?? w.empid) === wfhModal.empId)
                    .map((w, idx) => {
                      const dStr = w.allowedDate ?? w.alloweddate;
                      const displayDate = new Date(dStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: idx < wfhList.filter(x => (x.empId ?? x.empid) === wfhModal.empId).length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)' }}>📅 {displayDate}</span>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Revoke WFH Permit"
                            onClick={() => handleRevokeWfh(dStr.split('T')[0])}
                            style={{ color: '#EF4444', padding: 2 }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setWfhModal(null)}>Close</button>
            </div>
          </Modal>
        )}
        {/* Add Incentive Modal */}
        {incentiveModal && (
          <Modal title={`Add Incentive for ${incentiveModal.name}`} onClose={() => setIncentiveModal(null)}>
            <form onSubmit={handleAddIncentive}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    placeholder="e.g. 5000"
                    value={incentiveAmount}
                    onChange={e => setIncentiveAmount(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select
                    className="form-select"
                    required
                    value={incentiveType}
                    onChange={e => setIncentiveType(e.target.value)}
                  >
                    <option value="Performance">Performance Bonus</option>
                    <option value="Project Completion">Project Completion</option>
                    <option value="Referral">Referral Bonus</option>
                    <option value="Festive">Festive Bonus</option>
                    <option value="Special">Special Reward</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason / Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Enter reason for incentive..."
                    value={incentiveReason}
                    onChange={e => setIncentiveReason(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Month *</label>
                    <select
                      className="form-select"
                      value={incentiveMonth}
                      onChange={e => setIncentiveMonth(e.target.value)}
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                          <option key={m} value={i + 1}>{m}</option>
                        ))}
                    </select>
                  </div>
                  <div style={{ width: 100 }}>
                    <label className="form-label">Year *</label>
                    <select
                      className="form-select"
                      value={incentiveYear}
                      onChange={e => setIncentiveYear(e.target.value)}
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIncentiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>payments</span>
                  Add Incentive
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>

      {/* Profile Drawer */}
      <ProfileDrawer
        isOpen={profileDrawerOpen}
        onClose={() => { setProfileDrawerOpen(false); setProfileDrawerEmpId(null); }}
        empId={profileDrawerEmpId}
      />

    </AppLayout>
  );
}
