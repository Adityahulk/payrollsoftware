import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ProfileDrawer from '../components/ProfileDrawer';
import apiClient from '../api/client';
import toast from 'react-hot-toast';

export default function ManageUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeScreenShare, setActiveScreenShare] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/User/space');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load space employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (empId, currentStatus) => {
    const action = currentStatus === 'Active' ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this employee's account?`)) return;

    try {
      const res = await apiClient.put(`/User/toggle-status/${empId}`, {});
      toast.success(res.data.message || 'Status updated successfully.');
      
      // Update local state smoothly
      setUsers(prev => prev.map(u => u.empId === empId ? { ...u, status: res.data.status } : u));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update employee status.');
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout role="employee">
      <div className="page-content fade-in">
        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Employee Space Directory</h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              Manage users in your designated department/space (soft active/inactive toggle control).
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '8px 14px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', marginRight: 10, fontSize: 20 }}>search</span>
            <input 
              type="text"
              placeholder="Search space users by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 14, width: '100%', color: 'var(--gray-700)' }}
            />
          </div>
        </div>

        {/* User Table */}
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
                  [...Array(5)].map((_, i) => (
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
                      <td><div className="skeleton animate-pulse" style={{ width: 60, height: 18, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 40, height: 14, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 80, height: 14, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div className="skeleton animate-pulse" style={{ width: 50, height: 18, background: 'var(--gray-200)', borderRadius: 4 }} /></td>
                      <td><div style={{ display: 'flex', justifyContent: 'center' }}><div className="skeleton animate-pulse" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gray-200)' }} /></div></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--gray-400)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 8, display: 'block', opacity: 0.4 }}>group_off</span>
                      No employees found in your space matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(emp => (
                    <tr key={emp.empId} style={{ borderBottom: '1px solid var(--gray-100)' }}>
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
                      <td>
                        <span className={`badge ${emp.role === 'TeamLead' ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: 11 }}>
                          {emp.role}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--gray-500)' }}>
                        #{emp.spaceId || '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                        {fmtDate(emp.dateOfJoining)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Toggle switch for Manager */}
                          <div 
                            onClick={() => handleToggleStatus(emp.empId, emp.status)}
                            style={{
                              width: 38, height: 20, borderRadius: 99,
                              background: emp.status === 'Active' ? '#16A34A' : 'var(--gray-300)',
                              position: 'relative', transition: 'background 0.2s', cursor: 'pointer'
                            }}
                          >
                            <div style={{
                              position: 'absolute', top: 2, left: emp.status === 'Active' ? 20 : 2,
                              width: 16, height: 16, borderRadius: '50%', background: '#fff',
                              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }} />
                          </div>
                          <span 
                            style={{
                              fontSize: 11, fontWeight: 700, 
                              color: emp.status === 'Active' ? '#16A34A' : '#DC2626'
                            }}
                          >
                            {emp.status}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                          <button 
                            className="icon-btn" 
                            title="View Profile Details"
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
                          {emp.role !== 'Admin' && emp.role !== 'SuperAdmin' && (
                            <button 
                              className="icon-btn" 
                              title="Monitor Live Screen"
                              aria-label="Monitor employee screen live"
                              onClick={() => navigate('/admin/live-monitoring')}
                              style={{
                                width: 32, height: 32, display: 'inline-flex', 
                                alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                                background: '#EEF2F6', color: '#6366F1'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>monitor</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dynamic Profile Drawer */}
      <ProfileDrawer 
        isOpen={drawerOpen} 
        onClose={() => { setDrawerOpen(false); setSelectedEmpId(null); }} 
        empId={selectedEmpId} 
      />

    </AppLayout>
  );
}
