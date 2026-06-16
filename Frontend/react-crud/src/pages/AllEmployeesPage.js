import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import ProfileDrawer from '../components/ProfileDrawer';
import { usersApi } from '../api/index';
import apiClient from '../api/client';
import toast from 'react-hot-toast';

export default function AllEmployeesPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    usersApi.getUsers()
      .then(r => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => { setUsers([]); toast.error('Failed to load employees.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleStatus = async (empId, currentStatus) => {
    const action = currentStatus === 'Active' ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this employee?`)) return;
    try {
      const res = await apiClient.put(`/User/toggle-status/${empId}`, {});
      toast.success(res.data.message || 'Status updated.');
      setUsers(prev => prev.map(u => u.empId === empId ? { ...u, status: res.data.status } : u));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const filteredUsers = useMemo(() => users.filter(u => {
    const matchSearch =
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  }), [users, searchTerm, filterRole]);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const ROLE_BADGE = {
    Admin: 'badge-error',
    Manager: 'badge-success',
    TeamLead: 'badge-warning',
    Employee: 'badge-primary',
  };

  return (
    <AppLayout role="admin">
      <div className="page-content fade-in">
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>All Employees</h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              Full company directory — manage status and view detailed profiles.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Stats chips */}
            {[
              { label: 'Total', value: users.length, color: '#4F46E5' },
              { label: 'Active', value: users.filter(u => (u.status || '').toLowerCase() === 'active').length, color: '#10B981' },
              { label: 'Inactive', value: users.filter(u => (u.status || '').toLowerCase() !== 'active').length, color: '#EF4444' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 99,
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '8px 14px', minWidth: 200 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', marginRight: 10, fontSize: 20 }}>search</span>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, width: '100%', color: 'var(--gray-700)' }}
                aria-label="Search employees"
              />
            </div>
            <select
              className="form-select"
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              style={{ width: 160 }}
              aria-label="Filter by role"
            >
              <option value="">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="TeamLead">Team Lead</option>
              <option value="Employee">Employee</option>
            </select>
            {(searchTerm || filterRole) && (
              <button
                className="btn btn-ghost"
                onClick={() => { setSearchTerm(''); setFilterRole(''); }}
                style={{ fontSize: 13, color: 'var(--gray-500)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Space</th>
                  <th>Joined Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(7)].map((_, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="skeleton animate-pulse" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-200)' }} />
                          <div>
                            <div className="skeleton animate-pulse" style={{ width: 120, height: 14, background: 'var(--gray-200)', borderRadius: 4, marginBottom: 4 }} />
                            <div className="skeleton animate-pulse" style={{ width: 160, height: 11, background: 'var(--gray-200)', borderRadius: 4 }} />
                          </div>
                        </div>
                      </td>
                      <td><div className="skeleton animate-pulse" style={{ width: 65, height: 18, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 40, height: 14, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 85, height: 14, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 55, height: 18, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton animate-pulse" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gray-200)' }} /></div></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '52px 0', color: 'var(--gray-400)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 10, display: 'block', opacity: 0.4 }}>group_off</span>
                      No employees found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(emp => (
                    <tr key={emp.empId} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      {/* Employee */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, background: 'var(--primary-50)', color: 'var(--primary-700)' }}>
                            {getInitials(emp.name || emp.email)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13.5 }}>{emp.name || 'User'}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{emp.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td>
                        <span className={`badge ${ROLE_BADGE[emp.role] || 'badge-gray'}`} style={{ fontSize: 11 }}>
                          {emp.role}
                        </span>
                      </td>

                      {/* Space */}
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--gray-500)' }}>
                        #{emp.spaceId || '—'}
                      </td>

                      {/* Joined Date */}
                      <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                        {fmtDate(emp.dateOfJoining)}
                      </td>

                      {/* Status toggle */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            onClick={() => handleToggleStatus(emp.empId, emp.status)}
                            title={`Click to ${emp.status === 'Active' ? 'deactivate' : 'activate'}`}
                            style={{
                              width: 38, height: 20, borderRadius: 99,
                              background: emp.status === 'Active' ? '#16A34A' : 'var(--gray-300)',
                              position: 'relative', transition: 'background 0.2s', cursor: 'pointer'
                            }}
                          >
                            <div style={{
                              position: 'absolute', top: 2,
                              left: emp.status === 'Active' ? 20 : 2,
                              width: 16, height: 16, borderRadius: '50%', background: '#fff',
                              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: emp.status === 'Active' ? '#16A34A' : '#DC2626' }}>
                            {emp.status || 'Active'}
                          </span>
                        </div>
                      </td>

                      {/* Details button */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="icon-btn"
                          title="View full profile"
                          aria-label="View profile"
                          onClick={() => { setSelectedEmpId(emp.empId); setDrawerOpen(true); }}
                          style={{
                            width: 32, height: 32, display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                            background: 'var(--primary-50)', color: 'var(--primary-600)'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!loading && filteredUsers.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> employees
              </span>
              {filterRole || searchTerm ? (
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearchTerm(''); setFilterRole(''); }}>
                  Clear filters
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Profile Drawer */}
      <ProfileDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedEmpId(null); }}
        empId={selectedEmpId}
      />
    </AppLayout>
  );
}
