import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import AppLayout from '../components/AppLayout';

// ═══════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════

const C = {
  bg: 'var(--gray-100)',
  surface: '#ffffff',
  surfaceHover: 'var(--gray-50)',
  surfaceAlt: 'var(--gray-50)',
  border: 'var(--gray-200)',
  accent: 'var(--primary-500)',
  accentLight: 'var(--primary-600)',
  accentDim: 'var(--primary-50)',
  text: 'var(--gray-900)',
  textMuted: 'var(--gray-500)',
  textDim: 'var(--gray-400)',
  white: '#ffffff',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--error)',
  info: 'var(--info)',
  purple: '#818CF8',
};

// ═══════════════════════════════════════════════════════════════════════
// REUSABLE STYLES
// ═══════════════════════════════════════════════════════════════════════

const badge = (status) => {
  const map = {
    Active: { bg: 'rgba(16,185,129,0.12)', color: C.success, dot: C.success },
    Pending: { bg: 'rgba(245,158,11,0.12)', color: C.warning, dot: C.warning },
    Inactive: { bg: 'rgba(139,141,152,0.12)', color: '#9CA3AF', dot: '#9CA3AF' },
    Suspended: { bg: 'rgba(239,68,68,0.12)', color: C.danger, dot: C.danger },
  };
  const s = map[status] || map.Inactive;
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: s.bg, color: s.color,
  };
};

const btn = (variant = 'primary', size = 'md') => {
  const pad = size === 'sm' ? '6px 12px' : '9px 18px';
  const fs = size === 'sm' ? 11 : 12;
  const base = {
    padding: pad, fontSize: fs, fontWeight: 700, border: 'none', borderRadius: 8,
    cursor: 'pointer', transition: 'all 0.15s ease', display: 'inline-flex',
    alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
  };
  const variants = {
    primary: { ...base, background: C.accent, color: '#fff' },
    success: { ...base, background: C.success, color: '#fff' },
    danger: { ...base, background: C.danger, color: '#fff' },
    warning: { ...base, background: C.warning, color: '#000' },
    outline: { ...base, background: 'transparent', color: C.accent, border: `1px solid ${C.accent}` },
    ghost: { ...base, background: 'rgba(255,255,255,0.04)', color: C.textMuted },
  };
  return variants[variant] || variants.primary;
};

// ═══════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function StatusDot({ color }) {
  return <span style={{
    width: 7, height: 7, borderRadius: '50%', background: color,
    boxShadow: `0 0 6px ${color}50`, flexShrink: 0,
  }} />;
}

function UsageBar({ current, max, label, color = C.accent }) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const overLimit = pct > 100;
  const barColor = overLimit ? C.danger : pct >= 80 ? C.warning : color;
  return (
    <div style={{ minWidth: 130 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{current}</span>
        <span style={{ fontSize: 11, color: C.textMuted }}>/ {max} {label}</span>
      </div>
      <div style={{
        width: '100%', height: 5, background: 'rgba(255,255,255,0.06)',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor,
          borderRadius: 99, transition: 'width 0.5s ease',
        }} />
      </div>
      {overLimit && (
        <div style={{ fontSize: 10, color: C.danger, fontWeight: 600, marginTop: 2 }}>
          ⚠ Exceeds advisory limit
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, loading, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onChange}
        disabled={loading}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none',
          background: checked ? C.success : 'rgba(239,68,68,0.4)',
          position: 'relative', cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.25s ease',
          opacity: loading ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff',
          position: 'absolute', top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.25s ease',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </button>
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: checked ? C.success : C.danger,
        }}>
          {checked ? 'Active' : 'Blocked'}
        </span>
      )}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 52, color: C.textDim, marginBottom: 12, display: 'block' }}>
        {icon}
      </span>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textMuted }}>{subtitle}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════

function ModalOverlay({ children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface, borderRadius: 16, padding: 28, width: '92%', maxWidth: 460,
          border: `1px solid ${C.border}`, boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function AdminInfoCard({ admin }) {
  return (
    <div style={{
      padding: 14, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`,
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{admin.name || admin.email}</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
        {admin.spaceName ? `Space: ${admin.spaceName}` : 'No space'} · #{admin.empId}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={badge(admin.status)}>
          <StatusDot color={badge(admin.status).color} />
          {admin.status}
        </span>
        {!admin.statusBySuperAdmin && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: 'rgba(239,68,68,0.12)', color: C.danger,
          }}>
            🔒 Blocked by SuperAdmin
          </span>
        )}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
        <span style={{ fontSize: 11, color: C.textMuted }}>
          <strong style={{ color: C.info }}>{admin.currentEmployeeCount}</strong> employees
        </span>
        <span style={{ fontSize: 11, color: C.textMuted }}>
          <strong style={{ color: C.purple }}>{admin.currentSpaceCount}</strong> spaces
        </span>
      </div>
    </div>
  );
}

function ApproveModal({ admin, onClose, onConfirm, loading }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="material-symbols-outlined" style={{ color: C.success, fontSize: 22 }}>verified</span>
        Approve Admin
      </div>
      <AdminInfoCard admin={admin} />
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
        This will activate the admin account. They will be able to log in and manage their workspace.
        No limitations are enforced — you can monitor their usage and take action if needed.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={btn('ghost')} onClick={onClose} disabled={loading}>Cancel</button>
        <button style={btn('success')} onClick={onConfirm} disabled={loading}>
          {loading ? 'Approving...' : '✓ Approve Admin'}
        </button>
      </div>
    </ModalOverlay>
  );
}

function StatusModal({ admin, onClose, onConfirm, loading, mode }) {
  const [status, setStatus] = useState(mode === 'revoke' ? 'Suspended' : (admin?.status || 'Active'));
  const [reason, setReason] = useState('');
  const needsReason = status !== 'Active';
  const canSubmit = status && (!needsReason || reason.trim().length > 0);

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="material-symbols-outlined" style={{ color: mode === 'revoke' ? C.danger : C.accent, fontSize: 22 }}>
          {mode === 'revoke' ? 'gpp_bad' : 'swap_horiz'}
        </span>
        {mode === 'revoke' ? 'Revoke Admin Access' : 'Change Admin Status'}
      </div>
      <AdminInfoCard admin={admin} />

      {mode === 'revoke' && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
          fontSize: 12, color: C.danger, lineHeight: 1.5,
        }}>
          <strong>⚠ Warning:</strong> Revoking this admin will suspend their account.
          All employees under their workspace will lose access to the system.
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
          New Status
        </label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
            border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
            cursor: 'pointer', boxSizing: 'border-box',
          }}
        >
          {mode !== 'revoke' && <option value="Active">Active</option>}
          <option value="Inactive">Inactive</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
          Reason {needsReason ? <span style={{ color: C.danger }}>*</span> : '(optional)'}
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Describe the reason for this action..."
          style={{
            width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
            border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
            minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={btn('ghost')} onClick={onClose} disabled={loading}>Cancel</button>
        <button
          style={btn(mode === 'revoke' ? 'danger' : 'primary')}
          onClick={() => onConfirm(status, reason)}
          disabled={!canSubmit || loading}
        >
          {loading ? 'Saving...' : mode === 'revoke' ? 'Revoke Access' : 'Update Status'}
        </button>
      </div>
    </ModalOverlay>
  );
}

function LimitsModal({ admin, onClose, onConfirm, loading }) {
  const [maxEmp, setMaxEmp] = useState(admin.numberOfEmployees || 100);
  const [maxSp, setMaxSp] = useState(admin.maxSpaces || 5);

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="material-symbols-outlined" style={{ color: C.accent, fontSize: 22 }}>tune</span>
        Edit Advisory Limits
      </div>
      <AdminInfoCard admin={admin} />

      <div style={{
        padding: '10px 14px', borderRadius: 8, marginBottom: 14,
        background: C.accentDim, border: `1px solid rgba(79, 70, 229, 0.15)`,
        fontSize: 12, color: C.accentLight, lineHeight: 1.5,
      }}>
        <strong>ℹ Advisory only:</strong> These limits are for monitoring purposes.
        Admins can still create beyond these limits. You can manually restrict them if they exceed the agreed terms.
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
          Max Employees (Advisory)
        </label>
        <input
          type="number"
          value={maxEmp}
          onChange={e => setMaxEmp(parseInt(e.target.value) || 0)}
          min={1}
          style={{
            width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
            border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          Currently using: <strong style={{ color: C.text }}>{admin.currentEmployeeCount}</strong> employees
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
          Max Spaces (Advisory)
        </label>
        <input
          type="number"
          value={maxSp}
          onChange={e => setMaxSp(parseInt(e.target.value) || 0)}
          min={1}
          style={{
            width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
            border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          Currently using: <strong style={{ color: C.text }}>{admin.currentSpaceCount}</strong> spaces
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={btn('ghost')} onClick={onClose} disabled={loading}>Cancel</button>
        <button style={btn('primary')} onClick={() => onConfirm(maxEmp, maxSp)} disabled={loading}>
          {loading ? 'Saving...' : 'Save Limits'}
        </button>
      </div>
    </ModalOverlay>
  );
}

function SettingsModal({ onClose, onConfirm, loading, user }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (newPassword) {
      if (!currentPassword) {
        setError('Current password is required to change password.');
        return;
      }
      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match.');
        return;
      }
    }

    onConfirm({
      name,
      email,
      currentPassword: currentPassword ? btoa(currentPassword) : null,
      newPassword: newPassword ? btoa(newPassword) : null,
    });
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="material-symbols-outlined" style={{ color: C.accent, fontSize: 22 }}>settings</span>
        SuperAdmin Settings
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 12, color: C.danger,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ margin: '8px 0', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Change Password</div>
          <span style={{ fontSize: 11, color: C.textMuted }}>Leave blank if you do not want to change it</span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
            Current Password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Required to change password"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Min 6 characters"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
              border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" style={btn('ghost')} onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" style={btn('primary')} disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ADD SUPER ADMIN MODAL (2-step)
// ═══════════════════════════════════════════════════════════════════════

function AddSuperAdminModal({ onClose, onConfirm, loading }) {
  const [step, setStep] = useState(1); // 1 = verify your password, 2 = fill new SA details
  const [yourPassword, setYourPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showYourPw, setShowYourPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const handleStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (!yourPassword) { setError('Please enter your current password.'); return; }
    setStep(2);
  };

  const handleStep2 = (e) => {
    e.preventDefault();
    setError('');
    if (!newEmail) { setError('Email is required.'); return; }
    if (!newName) { setError('Name is required.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    onConfirm({ yourPassword, newEmail, newName, newPassword });
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 13, background: C.bg,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <ModalOverlay onClose={onClose}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>person_add</span>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Add SuperAdmin</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Step {step} of 2 — {step === 1 ? 'Verify identity' : 'New account details'}</div>
          </div>
        </div>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {[1, 2].map(s => (
            <div key={s} style={{
              height: 4, flex: 1, borderRadius: 99,
              background: s <= step ? C.accent : C.border,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 12, color: C.danger, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
          {error}
        </div>
      )}

      {/* ─── STEP 1: Verify your password ─── */}
      {step === 1 && (
        <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            fontSize: 12, color: '#818CF8', lineHeight: 1.5,
          }}>
            🔐 For security, confirm your own SuperAdmin password before creating a new account.
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Your Current Password <span style={{ color: C.danger }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showYourPw ? 'text' : 'password'}
                value={yourPassword}
                onChange={e => setYourPassword(e.target.value)}
                placeholder="Enter your password to verify"
                autoFocus
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowYourPw(p => !p)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {showYourPw ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" style={btn('ghost')} onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" style={btn('primary')} disabled={!yourPassword}>
              Next →
            </button>
          </div>
        </form>
      )}

      {/* ─── STEP 2: New SA details ─── */}
      {step === 2 && (
        <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Full Name <span style={{ color: C.danger }}>*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Jane Admin"
              autoFocus
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Email Address <span style={{ color: C.danger }}>*</span>
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="admin@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Password <span style={{ color: C.danger }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw(p => !p)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {showNewPw ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Confirm Password <span style={{ color: C.danger }}>*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 4 }}>
            <button type="button" style={btn('ghost')} onClick={() => { setStep(1); setError(''); }} disabled={loading}>
              ← Back
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn('ghost')} onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" style={btn('primary')} disabled={loading}>
                {loading ? 'Creating...' : '✓ Create SuperAdmin'}
              </button>
            </div>
          </div>
        </form>
      )}
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [approveModal, setApproveModal] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [limitsModal, setLimitsModal] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddSuperAdminModal, setShowAddSuperAdminModal] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [adminsRes, pendingRes, statsRes] = await Promise.all([
        apiClient.get('/SuperAdmin/admins'),
        apiClient.get('/SuperAdmin/admins/pending'),
        apiClient.get('/SuperAdmin/stats'),
      ]);
      setAdmins(adminsRes.data);
      setPendingAdmins(pendingRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('[Dashboard] fetch error:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!approveModal) return;
    try {
      setActionLoading(true);
      await apiClient.patch(`/SuperAdmin/admins/${approveModal.empId}/approve`);
      toast.success(`${approveModal.email} approved!`);
      setApproveModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (status, reason) => {
    if (!statusModal) return;
    const { admin, mode } = statusModal;
    try {
      setActionLoading(true);
      if (mode === 'revoke') {
        await apiClient.patch(`/SuperAdmin/admins/${admin.empId}/revoke`, { status, reason });
        toast.success(`${admin.email} access revoked`);
      } else {
        await apiClient.patch(`/SuperAdmin/admins/${admin.empId}/status`, { status, reason });
        toast.success(`${admin.email} → ${status}`);
      }
      setStatusModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSuperAdminStatus = async (admin) => {
    const newStatus = !admin.statusBySuperAdmin;
    try {
      setToggleLoadingId(admin.empId);
      await apiClient.patch(`/SuperAdmin/admins/${admin.empId}/toggle-status`, {
        statusBySuperAdmin: newStatus,
      });
      toast.success(newStatus
        ? `✅ ${admin.name || admin.email} access granted`
        : `🔒 ${admin.name || admin.email} access blocked`
      );
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Toggle failed');
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleLimits = async (maxEmp, maxSp) => {
    if (!limitsModal) return;
    try {
      setActionLoading(true);
      await apiClient.patch(`/SuperAdmin/spaces/${limitsModal.spaceId}/limits`, {
        numberOfEmployees: maxEmp, maxSpaces: maxSp,
      });
      toast.success('Limits updated');
      setLimitsModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (settingsData) => {
    try {
      setActionLoading(true);
      const res = await apiClient.patch('/SuperAdmin/profile', settingsData);
      toast.success('Settings updated successfully!');
      
      const updatedUser = {
        ...user,
        email: res.data.email,
        name: res.data.name
      };
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setActionLoading(false);
      setShowSettingsModal(false);
    }
  };

  const handleCreateSuperAdmin = async ({ yourPassword, newEmail, newName, newPassword }) => {
    try {
      setActionLoading(true);
      await apiClient.post('/SuperAdmin/create-superadmin', {
        yourPassword,
        newEmail,
        newName,
        newPassword,
      });
      toast.success(`✅ SuperAdmin '${newName}' created! They can now login with ${newEmail}`);
      setShowAddSuperAdminModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create SuperAdmin');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────

  // New admins this month
  const now = new Date();
  const newAdminsThisMonth = admins.filter(a => {
    const doj = new Date(a.dateOfJoining);
    return doj.getMonth() === now.getMonth() && doj.getFullYear() === now.getFullYear();
  });

  const getFilteredList = () => {
    let list;
    if (activeTab === 'pending') list = pendingAdmins;
    else if (activeTab === 'new') list = newAdminsThisMonth;
    else list = admins;

    if (searchQuery.trim()) {
      list = list.filter(a =>
        (a.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.spaceName || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return list;
  };

  const filteredList = getFilteredList();

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppLayout role="superadmin">
      <div className="page-content fade-in">

        {/* Page Title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>
                Platform Governance
              </h1>
              <p style={{ fontSize: 13, color: C.textMuted }}>
                Monitor and manage all Admin accounts. Toggle access to control who can log in to the HRMS platform.
              </p>
            </div>
            {/* Header action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <button
                id="btn-add-superadmin"
                style={{
                  ...btn('primary'),
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                }}
                onClick={() => setShowAddSuperAdminModal(true)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                Add SuperAdmin
              </button>
              <button
                id="btn-superadmin-settings"
                style={btn('outline')}
                onClick={() => setShowSettingsModal(true)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>settings</span>
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* ═══ STATS CARDS ═════════════════════════════════════════════ */}
        {stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
            gap: 14, marginBottom: 28,
          }}>
            {[
              { val: stats.totalAdmins, lbl: 'Total Admins', icon: 'admin_panel_settings', color: C.accent },
              { val: stats.activeAdmins, lbl: 'Active', icon: 'check_circle', color: C.success },
              { val: stats.pendingAdmins, lbl: 'Pending', icon: 'pending', color: C.warning },
              { val: stats.suspendedAdmins, lbl: 'Suspended', icon: 'block', color: C.danger },
              { val: stats.totalSpaces, lbl: 'Workspaces', icon: 'corporate_fare', color: C.info },
              { val: stats.totalEmployees, lbl: 'Employees', icon: 'groups', color: C.purple },
              { val: stats.activeEmployees, lbl: 'Active Emp.', icon: 'person_check', color: C.success },
              { val: stats.pendingEmployees, lbl: 'Pending Emp.', icon: 'person_add', color: C.warning },
            ].map(({ val, lbl, icon, color }) => (
              <div
                key={lbl}
                style={{
                  background: C.surface, borderRadius: 14, padding: '18px 16px',
                  border: `1px solid ${C.border}`, transition: 'all 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', justifycontent: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{val ?? 0}</div>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color, opacity: 0.35 }}>{icon}</span>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginTop: 6,
                }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ TABS + SEARCH ═══════════════════════════════════════════ */}
        <div style={{
          display: 'flex', justifycontent: 'space-between', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20, flexWrap: 'wrap', gap: 12,
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', background: C.surface, borderRadius: 10, padding: 3,
            border: `1px solid ${C.border}`,
          }}>
            {[
              { key: 'pending', label: 'Pending Approvals', count: pendingAdmins.length },
              { key: 'new', label: 'New This Month', count: newAdminsThisMonth.length },
              { key: 'all', label: 'All Admins', count: admins.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '9px 16px', fontSize: 12, fontWeight: 700, border: 'none',
                  borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  background: activeTab === tab.key ? C.accent : 'transparent',
                  color: activeTab === tab.key ? '#fff' : C.textMuted,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 800,
                    background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : (tab.key === 'pending' ? C.warning : C.textDim),
                    color: activeTab === tab.key ? '#fff' : (tab.key === 'pending' ? '#000' : '#fff'),
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`,
            minWidth: 220,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: C.textMuted }}>search</span>
            <input
              type="text"
              placeholder="Search admins..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'none', border: 'none', outline: 'none', color: C.text,
                fontSize: 13, width: '100%',
              }}
            />
          </div>
        </div>

        {/* ═══ TABLE / LIST ════════════════════════════════════════════ */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: 36, height: 36, border: '3px solid rgba(255,255,255,0.06)',
              borderTopColor: C.accent, borderRadius: '50%',
              animation: 'spin 0.7s linear infinite', margin: '0 auto 14px',
            }} />
            <div style={{ fontSize: 13, color: C.textMuted }}>Loading admins...</div>
          </div>
        ) : filteredList.length === 0 ? (
          <EmptyState
            icon={activeTab === 'pending' ? 'task_alt' : activeTab === 'new' ? 'celebration' : 'group_off'}
            title={
              activeTab === 'pending' ? 'No pending approvals' :
              activeTab === 'new' ? 'No new admins this month' :
              'No admins found'
            }
            subtitle={
              activeTab === 'pending' ? 'All admin accounts are up to date.' :
              activeTab === 'new' ? 'No admins have joined this month.' :
              searchQuery ? 'Try a different search term.' : 'No admin accounts exist yet.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredList.map(admin => (
              <div
                key={admin.empId}
                style={{
                  background: C.surface, borderRadius: 14, padding: '18px 20px',
                  border: `1px solid ${!admin.statusBySuperAdmin ? 'rgba(239,68,68,0.25)' : C.border}`,
                  transition: 'all 0.15s',
                  cursor: 'default',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + '40'}
                onMouseLeave={e => e.currentTarget.style.borderColor = !admin.statusBySuperAdmin ? 'rgba(239,68,68,0.25)' : C.border}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifycontent: 'space-between', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 14,
                }}>
                  {/* Left: Admin info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 200px' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: admin.statusBySuperAdmin
                        ? `linear-gradient(135deg, ${C.accent}30, ${C.accentLight}20)`
                        : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${admin.statusBySuperAdmin ? C.accent + '25' : 'rgba(239,68,68,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800,
                      color: admin.statusBySuperAdmin ? C.accent : C.danger,
                    }}>
                      {(admin.name || admin.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                        {admin.name || admin.email}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                        {admin.email} · #{admin.empId}
                      </div>
                      {admin.spaceName && (
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }}>
                            corporate_fare
                          </span>
                          {admin.spaceName}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: Status + Usage + Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: '1 1 400px', flexWrap: 'wrap' }}>
                    {/* SuperAdmin Toggle */}
                    <div style={{ minWidth: 90 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        Access
                      </div>
                      <ToggleSwitch
                        checked={admin.statusBySuperAdmin}
                        onChange={() => handleToggleSuperAdminStatus(admin)}
                        loading={toggleLoadingId === admin.empId}
                        label
                      />
                    </div>

                    <div>
                      <span style={badge(admin.status)}>
                        <StatusDot color={badge(admin.status).color} />
                        {admin.status}
                      </span>
                    </div>

                    {/* Employee & Space counts */}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 70 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                          Employees
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.info }}>{admin.currentEmployeeCount}</div>
                      </div>
                      <div style={{ minWidth: 70 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                          Spaces
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{admin.currentSpaceCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '0 0 auto' }}>
                    {!admin.statusBySuperAdmin && (
                      <button style={btn('success', 'sm')} onClick={() => setApproveModal(admin)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                        Enable
                      </button>
                    )}
                    {admin.statusBySuperAdmin && (
                      <button style={btn('danger', 'sm')} onClick={() => setStatusModal({ admin, mode: 'revoke' })}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>block</span>
                        Revoke
                      </button>
                    )}
                    <button style={btn('outline', 'sm')} onClick={() => setStatusModal({ admin, mode: 'status' })}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>swap_horiz</span>
                      Status
                    </button>
                  </div>
                </div>

                {/* Blocked by SuperAdmin banner */}
                {!admin.statusBySuperAdmin && (
                  <div style={{
                    marginTop: 12, padding: '8px 14px', borderRadius: 8,
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)',
                    fontSize: 12, color: C.danger, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                    <strong>Blocked by SuperAdmin</strong> — This admin cannot log in to the HRMS platform
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ MODALS ════════════════════════════════════════════════════ */}
      {approveModal && (
        <ApproveModal
          admin={approveModal}
          onClose={() => setApproveModal(null)}
          onConfirm={handleApprove}
          loading={actionLoading}
        />
      )}
      {statusModal && (
        <StatusModal
          admin={statusModal.admin}
          mode={statusModal.mode}
          onClose={() => setStatusModal(null)}
          onConfirm={handleStatusChange}
          loading={actionLoading}
        />
      )}
      {limitsModal && (
        <LimitsModal
          admin={limitsModal}
          onClose={() => setLimitsModal(null)}
          onConfirm={handleLimits}
          loading={actionLoading}
        />
      )}
      {showSettingsModal && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettingsModal(false)}
          onConfirm={handleSaveSettings}
          loading={actionLoading}
        />
      )}
      {showAddSuperAdminModal && (
        <AddSuperAdminModal
          onClose={() => setShowAddSuperAdminModal(false)}
          onConfirm={handleCreateSuperAdmin}
          loading={actionLoading}
        />
      )}
    </AppLayout>
  );
}
