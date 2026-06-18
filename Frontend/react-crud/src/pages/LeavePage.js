import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { leavesApi } from '../api/leaves';
import toast from 'react-hot-toast';

// ─── Status badge styles ────────────────────────────────────────────────────
const STATUS_COLORS = {
  Pending:  { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  Approved: { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
  Rejected: { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' },
};

const TYPE_COLORS = {
  Normal:    { bg: '#EFF6FF', color: '#1D4ED8', icon: 'event_note' },
  Emergency: { bg: '#FFF7ED', color: '#C2410C', icon: 'emergency' },
  College:   { bg: '#F5F3FF', color: '#6D28D9', icon: 'school' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#F3F4F6', color: '#374151', border: '#D1D5DB' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.color,
        animation: status === 'Pending' ? 'pulse 2s infinite' : 'none',
      }} />
      {status}
    </span>
  );
}

function TypeBadge({ type, halfDay }) {
  const t = TYPE_COLORS[type] || TYPE_COLORS.Normal;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: t.bg, color: t.color,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }}>{t.icon}</span>
        {type}
      </span>
      {halfDay && (
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
          background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0',
        }}>½ Day</span>
      )}
    </span>
  );
}

// ─── Balance Card ────────────────────────────────────────────────────────────
function BalanceCard({ icon, label, used, allowed, color, gradFrom, gradTo }) {
  const remaining = Math.max(0, allowed - used);
  const pct = allowed > 0 ? Math.min((used / allowed) * 100, 100) : 0;
  return (
    <div style={{
      borderRadius: 16, padding: '20px 24px',
      background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(255,255,255,0.6)',
      backdropFilter: 'blur(8px)',
      flex: 1, minWidth: 160,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color }}>{icon}</span>
        <span style={{
          fontSize: 22, fontWeight: 800, color,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {remaining}<span style={{ fontSize: 14, opacity: 0.6 }}>/{allowed}</span>
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>{label}</div>
      <div style={{ height: 5, borderRadius: 99, background: 'rgba(0,0,0,0.08)' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: color,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>
        {used} used · {remaining} remaining
      </div>
    </div>
  );
}

// ─── Main LeavePage ──────────────────────────────────────────────────────────
export default function LeavePage({ isAdmin }) {
  const { user } = useAuth();
  const role = user?.role || 'Employee';
  const isApprover = isAdmin || role === 'Manager' || role === 'TeamLead';
  const isEmployee = !isAdmin && (role === 'Employee' || role === 'TeamLead' || role === 'Manager');

  // State
  const [myLeaves, setMyLeaves]       = useState([]);
  const [allLeaves, setAllLeaves]     = useState([]);
  const [balance, setBalance]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [tab, setTab]                 = useState(isApprover && isAdmin ? 'pending' : 'apply');
  const [filterStatus, setFilterStatus] = useState('Pending');

  const [form, setForm] = useState({
    leaveDate: '',
    leaveType: 'Normal',
    halfDay: false,
    reason: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadMyData = useCallback(async () => {
    try {
      const [leavesRes, balanceRes] = await Promise.all([
        leavesApi.getMyLeaves(),
        leavesApi.getLeaveBalance(),
      ]);
      setMyLeaves(leavesRes.data || []);
      setBalance(balanceRes.data || null);
    } catch (err) {
      console.warn('Failed to load your leave data silently', err);
    }
  }, []);

  const loadAllLeaves = useCallback(async () => {
    try {
      const res = await leavesApi.getAllLeaves();
      setAllLeaves(res.data || []);
    } catch (err) {
      console.warn('Failed to load leave requests silently', err);
    }
  }, []);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      await loadMyData();
      if (isApprover) await loadAllLeaves();
      setLoading(false);
    };
    fetch();
  }, [loadMyData, loadAllLeaves, isApprover]);

  // ─── Apply Leave ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.leaveDate)             errs.leaveDate = 'Please select a date.';
    if (!form.leaveType)             errs.leaveType = 'Please select a leave type.';
    if (!form.reason?.trim())        errs.reason    = 'Please provide a reason.';
    if (form.leaveDate) {
      const selected = new Date(form.leaveDate);
      const today    = new Date(); today.setHours(0, 0, 0, 0);
      if (selected < today)          errs.leaveDate = 'Cannot apply leave for past dates.';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await leavesApi.applyLeave({
        leaveDate: form.leaveDate,
        leaveType: form.leaveType,
        halfDay:   form.halfDay,
        reason:    form.reason,
      });
      toast.success('✅ Leave applied successfully!');
      setForm({ leaveDate: '', leaveType: 'Normal', halfDay: false, reason: '' });
      setFormErrors({});
      await loadMyData();
      if (!isAdmin) setTab('history');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to apply leave.';
      toast.error(msg);
    }
    setSubmitting(false);
  };

  // ─── Approve / Reject ───────────────────────────────────────────────────────
  const handleStatusUpdate = async (leaveId, status) => {
    setApprovingId(leaveId);
    try {
      await leavesApi.updateStatus(leaveId, status);
      toast.success(`Leave ${status.toLowerCase()} successfully.`);
      await loadAllLeaves();
      await loadMyData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update status.';
      toast.error(msg);
    }
    setApprovingId(null);
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const pendingLeaves = allLeaves.filter(l => l.status === 'Pending');
  const displayLeaves = filterStatus === 'All' ? allLeaves : allLeaves.filter(l => l.status === filterStatus);

  // ─── Tab definitions ─────────────────────────────────────────────────────────
  const employeeTabs = [
    { key: 'apply',   label: 'Apply Leave',  icon: 'add_circle' },
    { key: 'history', label: 'My History',   icon: 'history' },
  ];
  const approverTabs = [
    { key: 'pending',  label: `Pending (${pendingLeaves.length})`, icon: 'pending_actions' },
    { key: 'all',      label: 'All Requests', icon: 'list_alt' },
  ];
  const shownTabs = isAdmin
    ? [...approverTabs, ...(isEmployee ? employeeTabs : [])]
    : [...employeeTabs, ...(isApprover ? approverTabs : [])];

  return (
    <AppLayout role={isAdmin ? 'admin' : 'employee'}>
      <div className="page-content fade-in">
        {/* ── Page Header ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            Leave Management
          </h1>
          <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
            {isAdmin
              ? 'Review and approve employee leave requests'
              : 'Apply for leave and track your leave history'}
          </p>
        </div>

        {/* ── Leave Balance Cards (Employee) ──────────────────────────────── */}
        {isEmployee && balance && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <BalanceCard
              icon="emergency"
              label="Emergency Leaves / Month"
              used={balance.usedEmergency ?? balance.UsedEmergency ?? 0}
              allowed={balance.allowedEmergency ?? balance.AllowedEmergency ?? 1}
              color="#C2410C"
              gradFrom="#FFF7ED"
              gradTo="#FED7AA"
            />
            <BalanceCard
              icon="school"
              label="College Leaves / Month"
              used={balance.usedCollege ?? balance.UsedCollege ?? 0}
              allowed={balance.allowedCollege ?? balance.AllowedCollege ?? 1}
              color="#6D28D9"
              gradFrom="#F5F3FF"
              gradTo="#DDD6FE"
            />
            <div style={{
              flex: 1, minWidth: 160, borderRadius: 16, padding: '20px 24px',
              background: 'linear-gradient(135deg, #F0FDF4, #BBF7D0)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '1px solid rgba(255,255,255,0.6)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#16A34A' }}>event_available</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#16A34A', fontFamily: 'JetBrains Mono, monospace' }}>
                  {myLeaves.filter(l => l.status === 'Approved' || l.Status === 'Approved').length}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Normal Leaves</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {myLeaves.filter(l => (l.status ?? l.Status) === 'Pending').length} pending approval
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          {shownTabs.map(t => (
            <button
              key={t.key}
              className={`tab-btn ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── APPLY LEAVE TAB ─────────────────────────────────────────────── */}
        {tab === 'apply' && isEmployee && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,400px) 1fr', gap: 24, alignItems: 'start' }}>
            {/* Form */}
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary-500)' }}>add_circle</span>
                Apply for Leave
              </h3>
              <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Date */}
                <div className="form-group">
                  <label className="form-label">Leave Date *</label>
                  <input
                    type="date"
                    className={`form-input ${formErrors.leaveDate ? 'input-error' : ''}`}
                    min={todayStr}
                    value={form.leaveDate}
                    onChange={e => setForm(p => ({ ...p, leaveDate: e.target.value }))}
                  />
                  {formErrors.leaveDate && <span className="form-error">{formErrors.leaveDate}</span>}
                </div>

                {/* Leave Type */}
                <div className="form-group">
                  <label className="form-label">Leave Type *</label>
                  <select
                    className={`form-select ${formErrors.leaveType ? 'input-error' : ''}`}
                    value={form.leaveType}
                    onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))}
                  >
                    <option value="Normal">🗓️ Normal Leave</option>
                    <option value="Emergency"
                      disabled={balance && (balance.remainingEmergency ?? balance.RemainingEmergency ?? 1) <= 0}>
                      🚨 Emergency Leave {balance && `(${balance.remainingEmergency ?? balance.RemainingEmergency ?? '?'} left)`}
                    </option>
                    <option value="College"
                      disabled={balance && (balance.remainingCollege ?? balance.RemainingCollege ?? 1) <= 0}>
                      🎓 College Leave {balance && `(${balance.remainingCollege ?? balance.RemainingCollege ?? '?'} left)`}
                    </option>
                  </select>
                  {formErrors.leaveType && <span className="form-error">{formErrors.leaveType}</span>}
                </div>

                {/* Half Day Toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  background: form.halfDay ? '#F0FDF4' : 'var(--gray-50)',
                  border: `1px solid ${form.halfDay ? '#BBF7D0' : 'var(--gray-200)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }} onClick={() => setForm(p => ({ ...p, halfDay: !p.halfDay }))}>
                  <div style={{
                    width: 36, height: 20, borderRadius: 99,
                    background: form.halfDay ? '#16A34A' : 'var(--gray-300)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: form.halfDay ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Half-Day Leave</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      Takes only half your daily leave entitlement
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <textarea
                    className={`form-input ${formErrors.reason ? 'input-error' : ''}`}
                    rows={3}
                    placeholder="Briefly explain the reason for your leave..."
                    value={form.reason}
                    onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  />
                  {formErrors.reason && <span className="form-error">{formErrors.reason}</span>}
                </div>

                {/* Info box */}
                {form.leaveType === 'Emergency' && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 12, color: '#92400E' }}>
                    🚨 <strong>Emergency Leave</strong> — Paid, no salary deduction. Limited to {balance?.allowedEmergency ?? balance?.AllowedEmergency ?? 1}/month.
                  </div>
                )}
                {form.leaveType === 'College' && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F5F3FF', border: '1px solid #DDD6FE', fontSize: 12, color: '#5B21B6' }}>
                    🎓 <strong>College Leave</strong> — Paid, no salary deduction. Limited to {balance?.allowedCollege ?? balance?.AllowedCollege ?? 1}/month.
                  </div>
                )}
                {form.leaveType === 'Normal' && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 12, color: '#1D4ED8' }}>
                    📋 <strong>Normal Leave</strong> — Paid when approved. Unapproved = Absent.
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ justifyContent: 'center', marginTop: 4 }}
                >
                  {submitting
                    ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Submitting...</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>Apply Leave</>}
                </button>
              </form>
            </div>

            {/* Quick Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Recent leaves preview */}
              <div className="card">
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--gray-700)' }}>
                  Recent Applications
                </h4>
                {myLeaves.slice(0, 4).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)', fontSize: 13 }}>
                    No leave applications yet
                  </div>
                ) : myLeaves.slice(0, 4).map(l => (
                  <div key={l.leaveId ?? l.leaveid} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid var(--gray-100)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(l.leaveDate ?? l.leavedate)}</div>
                      <TypeBadge type={l.leaveType ?? l.leavetype ?? 'Normal'} halfDay={l.halfDay ?? l.halfday} />
                    </div>
                    <StatusBadge status={l.status ?? l.Status ?? 'Pending'} />
                  </div>
                ))}
                {myLeaves.length > 4 && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTab('history')}>
                    View all {myLeaves.length} applications →
                  </button>
                )}
              </div>

              {/* Rules card */}
              <div className="card" style={{ background: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)', border: '1px solid var(--gray-200)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📌 Leave Rules</h4>
                {[
                  { icon: 'calendar_today', text: 'Only today and future dates allowed' },
                  { icon: 'event_busy',     text: 'Past days without leave = Absent' },
                  { icon: 'emergency',      text: `Emergency: ${balance?.allowedEmergency ?? 1}/month, paid` },
                  { icon: 'school',         text: `College: ${balance?.allowedCollege ?? 1}/month, paid` },
                  { icon: 'event_note',     text: 'Normal: Unlimited, paid if approved' },
                  { icon: 'schedule',       text: 'Half-day option available for all types' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--gray-600)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--primary-500)', flexShrink: 0 }}>{r.icon}</span>
                    {r.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ─────────────────────────────────────────────────── */}
        {tab === 'history' && isEmployee && (
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>My Leave History</h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" /></div>
            ) : myLeaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 8 }}>event_busy</span>
                No leave applications yet
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
                      {['Date', 'Type', 'Reason', 'Status', 'Applied On'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--gray-600)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map(l => (
                      <tr key={l.leaveId ?? l.leaveid} style={{ borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{fmtDate(l.leaveDate ?? l.leavedate)}</td>
                        <td style={{ padding: '12px 14px' }}><TypeBadge type={l.leaveType ?? l.leavetype ?? 'Normal'} halfDay={l.halfDay ?? l.halfday} /></td>
                        <td style={{ padding: '12px 14px', color: 'var(--gray-600)', maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.reason ?? l.Reason ?? '—'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}><StatusBadge status={l.status ?? l.Status ?? 'Pending'} /></td>
                        <td style={{ padding: '12px 14px', color: 'var(--gray-500)', fontSize: 11 }}>{fmtDate(l.createdAt ?? l.createdat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PENDING / ALL TABS (Approver View) ─────────────────────────── */}
        {(tab === 'pending' || tab === 'all') && isApprover && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                {tab === 'pending' ? '⏳ Pending Leave Requests' : '📋 All Leave Requests'}
              </h3>
              {tab === 'all' && (
                <div style={{ display: 'flex', gap: 4, background: 'var(--gray-100)', padding: 4, borderRadius: 8 }}>
                  {['All', 'Pending', 'Approved', 'Rejected'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)} style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none',
                      background: filterStatus === s ? '#fff' : 'transparent',
                      color: filterStatus === s ? 'var(--primary-600)' : 'var(--gray-600)',
                      borderRadius: 6, cursor: 'pointer',
                      boxShadow: filterStatus === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s',
                    }}>{s}</button>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" /></div>
            ) : displayLeaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray-400)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 8 }}>
                  {tab === 'pending' ? 'check_circle' : 'event_busy'}
                </span>
                {tab === 'pending' ? 'No pending leave requests! 🎉' : 'No leave requests found'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)', borderBottom: '2px solid var(--gray-200)' }}>
                      {['Employee', 'Date', 'Type', 'Reason', 'Status', 'Applied', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--gray-600)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayLeaves.map(l => {
                      const lid = l.leaveid ?? l.LeaveId;
                      const lStatus = l.status ?? l.Status ?? 'Pending';
                      const isPending = lStatus === 'Pending';
                      const isProcessing = approvingId === lid;

                      return (
                        <tr key={lid}
                          style={{ borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {l.employeename ?? l.EmployeeName ?? `Emp #${l.empid ?? l.EmpId}`}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                              {l.email ?? l.Email ?? ''}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>{fmtDate(l.leavedate ?? l.LeaveDate)}</td>
                          <td style={{ padding: '12px 14px' }}><TypeBadge type={l.leavetype ?? l.LeaveType ?? 'Normal'} halfDay={l.halfday ?? l.HalfDay} /></td>
                          <td style={{ padding: '12px 14px', color: 'var(--gray-600)', maxWidth: 200 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.reason ?? l.Reason ?? '—'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}><StatusBadge status={lStatus} /></td>
                          <td style={{ padding: '12px 14px', color: 'var(--gray-500)', fontSize: 11 }}>{fmtDate(l.createdat ?? l.CreatedAt)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            {isPending ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className="btn btn-sm"
                                  disabled={isProcessing}
                                  onClick={() => handleStatusUpdate(lid, 'Approved')}
                                  style={{
                                    background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7',
                                    padding: '4px 12px', fontSize: 11, fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                  }}
                                >
                                  {isProcessing ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>}
                                  Approve
                                </button>
                                <button
                                  className="btn btn-sm"
                                  disabled={isProcessing}
                                  onClick={() => handleStatusUpdate(lid, 'Rejected')}
                                  style={{
                                    background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5',
                                    padding: '4px 12px', fontSize: 11, fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                                {lStatus === 'Approved' ? '✅ Approved' : '❌ Rejected'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </AppLayout>
  );
}
