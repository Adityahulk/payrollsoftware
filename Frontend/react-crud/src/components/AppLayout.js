import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import logoMicrotechnique from '../logo.png';
import NotificationBell from './NotificationBell';
import toast from 'react-hot-toast';


// Base employee nav items (shared by Employee, TeamLead, Manager)
const EMPLOYEE_BASE_NAV = [
  { path: '/employee', icon: 'dashboard', label: 'Dashboard' },
  { path: '/employee/attendance', icon: 'calendar_month', label: 'Attendance' },
  { path: '/employee/projects', icon: 'folder_open', label: 'Projects' },
  { path: '/employee/worklogs', icon: 'schedule', label: 'Work Logs' },
  { path: '/employee/salary', icon: 'currency_rupee', label: 'Payroll / CTC' },
  { path: '/employee/progress', icon: 'trending_up', label: 'Progress Report' },
  { path: '/employee/queries', icon: 'help_center', label: 'Queries' },
  { path: '/employee/leaves', icon: 'event_busy', label: 'Leaves' },
  { path: '/employee/profile', icon: 'person', label: 'Profile' },
];

// Extra items for TeamLead (after Dashboard)
const TL_EXTRA_NAV = [
  { path: '/employee/all-employees', icon: 'groups', label: 'Team Members' },
  { path: '/admin/attendance', icon: 'event_available', label: 'Team Attendance' },
  { path: '/admin/live-monitoring', icon: 'videocam', label: 'Live Monitoring' },
];

// Extra items for Manager (after Dashboard)
// NOTE: Manager does NOT get /admin/users — that is Admin-only.
// Manager sees the read-only employee directory at /employee/all-employees.
const MANAGER_EXTRA_NAV = [
  { path: '/employee/all-employees', icon: 'groups', label: 'All Employees' },
  { path: '/admin/attendance', icon: 'event_available', label: 'Employee Attendance' },
  { path: '/employee/manage-users', icon: 'manage_accounts', label: 'Manage Employees' },
  { path: '/admin/live-monitoring', icon: 'videocam', label: 'Live Monitoring' },
];

const NAV_ITEMS = {
  superadmin: [
    { path: '/superadmin', icon: 'admin_panel_settings', label: 'Governance' },
  ],
  admin: [
    { path: '/admin', icon: 'dashboard', label: 'Dashboard' },
    { path: '/admin/users', icon: 'group', label: 'Employee Mgmt' },
    { path: '/admin/projects', icon: 'folder_open', label: 'Projects' },
    { path: '/admin/attendance', icon: 'event_available', label: 'Attendance' },
    { path: '/admin/progress', icon: 'trending_up', label: 'Progress Report' },
    { path: '/admin/salary', icon: 'payments', label: 'Payroll / CTC' },
    { path: '/admin/queries', icon: 'contact_support', label: 'Queries' },
    { path: '/admin/leaves', icon: 'event_busy', label: 'Leaves' },
    { path: '/admin/spaces', icon: 'corporate_fare', label: 'Spaces' },
    { path: '/admin/live-monitoring', icon: 'videocam', label: 'Live Monitoring' },
    { path: '/admin/settings/payslip', icon: 'settings', label: 'Payslip Settings' },
    { path: '/admin/profile', icon: 'person', label: 'Profile' },
  ],
};

const BOTTOM_NAV = {
  superadmin: [
    { path: '/superadmin', icon: 'admin_panel_settings', label: 'Governance' },
  ],
  admin: [
    { path: '/admin', icon: 'dashboard', label: 'Home' },
    { path: '/admin/users', icon: 'group', label: 'Employees' },
    { path: '/admin/salary', icon: 'payments', label: 'Payroll' },
    { path: '/admin/queries', icon: 'contact_support', label: 'Queries' },
  ],
  employee: [
    { path: '/employee', icon: 'dashboard', label: 'Home' },
    { path: '/employee/attendance', icon: 'calendar_month', label: 'Attendance' },
    { path: '/employee/projects', icon: 'folder_open', label: 'Projects' },
    { path: '/employee/profile', icon: 'person', label: 'Profile' },
  ],
};

function buildEmployeeNav(role) {
  // Insert role-specific extras after the Dashboard item
  const base = [...EMPLOYEE_BASE_NAV];
  if (role === 'TeamLead') {
    // Insert Team Members after Dashboard
    base.splice(1, 0, ...TL_EXTRA_NAV);
  } else if (role === 'Manager') {
    base.splice(1, 0, ...MANAGER_EXTRA_NAV);
  }
  return base;
}

function getRoleLabel(role) {
  if (role === 'TeamLead') return 'Team Lead Portal';
  if (role === 'Manager') return 'Manager Portal';
  if (role === 'Admin') return 'Admin Portal';
  if (role === 'SuperAdmin') return 'SuperAdmin Portal';
  return 'Employee Portal';
}

function initials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function AppLayout({ children, role = 'employee' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dotsOpen, setDotsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef(null);
  const dotsRef = useRef(null);



  const handleSearchSubmit = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return;

    if (q.includes('work') || q.includes('log') || q.includes('working')) {
      if (role === 'admin') navigate('/admin');
      else navigate('/employee/worklogs');
      toast.success('Navigated to Working Logs section');
    } else if (q.includes('attend') || q.includes('clock') || q.includes('break')) {
      if (role === 'admin') navigate('/admin/attendance');
      else navigate('/employee/attendance');
      toast.success('Navigated to Attendance section');
    } else if (q.includes('project') || q.includes('task')) {
      if (role === 'admin') navigate('/admin/projects');
      else navigate('/employee/projects');
      toast.success('Navigated to Projects section');
    } else if (q.includes('salary') || q.includes('payroll') || q.includes('ctc') || q.includes('pay')) {
      if (role === 'admin') navigate('/admin/salary');
      else navigate('/employee/salary');
      toast.success('Navigated to Payroll / CTC section');
    } else if (q.includes('leave') || q.includes('holiday') || q.includes('vacation')) {
      if (role === 'admin') navigate('/admin/leaves');
      else navigate('/employee/leaves');
      toast.success('Navigated to Leaves section');
    } else if (q.includes('query') || q.includes('notice') || q.includes('warning')) {
      if (role === 'admin') navigate('/admin/queries');
      else navigate('/employee/queries');
      toast.success('Navigated to Queries & Notices section');
    } else if (q.includes('profile') || q.includes('user') || q.includes('account')) {
      if (role === 'admin') navigate('/admin/profile');
      else navigate('/employee/profile');
      toast.success('Navigated to Profile section');
    } else if (q.includes('space') || q.includes('department')) {
      if (role === 'admin') navigate('/admin/spaces');
      else navigate('/employee/leaves');
      toast.success('Navigated to Spaces section');
    } else {
      toast.error(`No matching section found for "${searchQuery}"`);
    }
  };

  // Determine nav based on actual user role (not just the `role` prop)
  const actualRole = user?.role || 'Employee';
  let navItems;
  if (role === 'superadmin') {
    navItems = NAV_ITEMS.superadmin;
  } else if (role === 'admin') {
    navItems = NAV_ITEMS.admin;
  } else {
    // For employee layout — build role-aware nav
    navItems = buildEmployeeNav(actualRole);
  }
  const bottomItems = BOTTOM_NAV[role] || BOTTOM_NAV.employee;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (dotsRef.current && !dotsRef.current.contains(e.target)) {
        setDotsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="app-layout">
      {/* ── Mobile overlay ──────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────────── */}
      <aside
        className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-icon" style={{ background: 'transparent', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
            <img src={logoMicrotechnique} alt="Microtechnique Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div className="brand-name" style={{ color: '#6B21A8', textTransform: 'uppercase', fontSize: '11px', fontWeight: 800, letterSpacing: '0.03em' }}>Microtechnique Payroll</div>
            <div className="brand-role">{getRoleLabel(role === 'admin' ? 'Admin' : actualRole)}</div>
          </div>
        </div>

        {/* Role badge for TL/Manager */}
        {role !== 'admin' && (actualRole === 'TeamLead' || actualRole === 'Manager') && (
          <div style={{ padding: '6px 16px 0' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
              background: actualRole === 'TeamLead' ? '#FEF3C7' : '#DBEAFE',
              color: actualRole === 'TeamLead' ? '#92400E' : '#1D4ED8',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                {actualRole === 'TeamLead' ? 'supervisor_account' : 'manage_accounts'}
              </span>
              {actualRole === 'TeamLead' ? 'Team Lead' : 'Manager'} Access
            </span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8 }}>
          {navItems.map(item => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              aria-current={isActive(item.path) ? 'page' : undefined}
              aria-label={item.label}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
              <span>{item.label}</span>
              {isActive(item.path) && (
                <span style={{ marginLeft: 'auto', width: 4, height: 20, background: '#4F46E5', borderRadius: 2 }} />
              )}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="avatar" style={{ background: '#4F46E5', color: '#fff' }}>
            {initials(user?.name || 'U')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {user?.role} · #{user?.empId}
            </div>
          </div>
          <button className="icon-btn" onClick={logout} title="Logout" aria-label="Logout">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      <div className="main-content">
        {/* Top Navbar */}
        <header className="top-header" role="banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Three Dots Menu / Sidebar Toggle (⋮) */}
            <div style={{ position: 'relative' }} ref={dotsRef}>
              <button
                className="icon-btn"
                onClick={() => {
                  if (window.innerWidth <= 1024) {
                    setSidebarOpen(prev => !prev);
                  } else {
                    setDotsOpen(prev => !prev);
                  }
                }}
                title="Menu / Quick Shortcuts"
                aria-label="Menu shortcuts"
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_vert</span>
              </button>
              {dotsOpen && (
                <div className="card" style={{
                  position: 'absolute',
                  top: 42,
                  left: 0,
                  width: 200,
                  zIndex: 1000,
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                  borderRadius: 8,
                  padding: '6px 0',
                  background: '#FFF',
                  border: '1px solid var(--gray-100)'
                }}>
                  {[
                    { label: 'Working Logs', icon: 'schedule', path: role === 'admin' ? '/admin' : '/employee/worklogs' },
                    { label: 'Attendance', icon: 'calendar_month', path: role === 'admin' ? '/admin/attendance' : '/employee/attendance' },
                    { label: 'Projects', icon: 'folder_open', path: role === 'admin' ? '/admin/projects' : '/employee/projects' },
                    { label: 'Queries & Notices', icon: 'help_center', path: role === 'admin' ? '/admin/queries' : '/employee/queries' },
                    { label: 'My Profile', icon: 'person', path: role === 'admin' ? '/admin/profile' : '/employee/profile' }
                  ].map(item => (
                    <button
                      key={item.label}
                      className="dropdown-item"
                      onClick={() => {
                        navigate(item.path);
                        setDotsOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 13,
                        color: 'var(--gray-700)',
                        border: 'none',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--gray-400)' }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logo (mobile only) */}
            <div className="mobile-logo" style={{ alignItems: 'center', gap: 6 }}>
              <img src={logoMicrotechnique} alt="Microtechnique Logo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: 13, color: '#6B21A8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Microtechnique Payroll</span>
            </div>

            {/* Search */}
            <div className="search-bar" role="search">
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9CA3AF' }}>search</span>
              <input
                type="search"
                placeholder="Search sections (e.g. working)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
                aria-label="Search"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Notifications */}
            <NotificationBell />

            {/* Profile dropdown */}
            <div style={{ position: 'relative' }} ref={profileRef}>
              <button
                className="profile-trigger"
                onClick={() => setProfileOpen(p => !p)}
                aria-haspopup="true"
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: '#4F46E5', color: '#fff' }}>
                  {initials(user?.name || 'U')}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }} className="profile-name">
                  {user?.name?.split(' ')[0] || 'User'}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6B7280' }}>expand_more</span>
              </button>

              {profileOpen && (
                <div className="profile-dropdown" role="menu" aria-label="Profile options">
                  <div className="profile-dropdown-header">
                    <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, background: '#4F46E5', color: '#fff' }}>
                      {initials(user?.name || 'U')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{user?.role}</div>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  {[
                    {
                      icon: 'person',
                      label: 'Profile',
                      action: () => {
                        if (role === 'admin') navigate('/admin/profile');
                        else navigate('/employee/profile');
                      }
                    },
                    {
                      icon: 'lock',
                      label: 'Change Password',
                      action: () => {
                        if (role === 'admin') navigate('/admin/profile', { state: { openChangePassword: true } });
                        else navigate('/employee/profile', { state: { openChangePassword: true } });
                      }
                    },
                  ].map(item => (
                    <button
                      key={item.label}
                      className="dropdown-item"
                      onClick={() => { item.action(); setProfileOpen(false); }}
                      role="menuitem"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <div className="profile-dropdown-divider" />
                  <button
                    className="dropdown-item dropdown-item-danger"
                    onClick={() => { logout(); setProfileOpen(false); }}
                    role="menuitem"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, paddingBottom: 80 }}>
          {children}
        </main>
      </div>

      {/* ── Bottom navigation (mobile) ────────────────────── */}
      <nav className="bottom-nav" aria-label="Mobile bottom navigation">
        {bottomItems.map(item => (
          <button
            key={item.path}
            className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={isActive(item.path) ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
