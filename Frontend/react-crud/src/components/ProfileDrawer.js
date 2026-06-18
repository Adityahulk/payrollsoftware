import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { BACKEND_ORIGIN } from '../config';
import toast from 'react-hot-toast';

const TAB_ICONS = {
  overview:  'dashboard',
  personal:  'person',
  bank:      'account_balance',
  documents: 'folder_open',
};

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--gray-800)', fontFamily: mono ? 'JetBrains Mono' : 'inherit' }}>
        {value || <span style={{ color: 'var(--gray-300)', fontStyle: 'italic' }}>Not provided</span>}
      </span>
    </div>
  );
}

export default function ProfileDrawer({ isOpen, onClose, empId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isOpen || !empId) return;
    setActiveTab('overview');
    const fetchFullProfile = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/User/${empId}/full-profile`);
        setProfile(res.data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load employee profile.');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchFullProfile();
  }, [isOpen, empId, onClose]);

  if (!isOpen) return null;

  const initials = (name) => {
    if (!name) return '??';
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const ROLE_BADGE = { Admin: 'badge-error', Manager: 'badge-success', TeamLead: 'badge-warning', Employee: 'badge-primary' };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const DOC_ICONS = { PAN: 'badge', Aadhar: 'fingerprint', Passport: 'import_contacts', Degree: 'school', Other: 'description' };

  const tabs = [
    { key: 'overview',  label: 'Overview'  },
    { key: 'personal',  label: 'Personal'  },
    { key: 'bank',      label: 'Bank'      },
    { key: 'documents', label: 'Documents' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1000,
        width: 480, maxWidth: '100vw', background: '#fff',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.28s cubic-bezier(.16,1,.3,1)'
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            {loading || !profile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="skeleton animate-pulse" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gray-200)' }} />
                <div>
                  <div className="skeleton animate-pulse" style={{ width: 140, height: 16, background: 'var(--gray-200)', borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton animate-pulse" style={{ width: 100, height: 12, background: 'var(--gray-200)', borderRadius: 4 }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="avatar" style={{
                  width: 56, height: 56, fontSize: 20, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--primary-600), #7C3AED)',
                  color: '#fff', fontWeight: 700
                }}>
                  {initials(profile.user?.name || profile.user?.email)}
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{profile.user?.name || 'Employee'}</h2>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', margin: '2px 0 6px' }}>{profile.user?.email}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${ROLE_BADGE[profile.user?.role] || 'badge-gray'}`}>{profile.user?.role}</span>
                    <span className="badge badge-gray">Dept #{profile.user?.spaceId || '—'}</span>
                    <span className={`badge ${profile.user?.status === 'Active' ? 'badge-success' : 'badge-error'}`}>{profile.user?.status}</span>
                  </div>
                </div>
              </div>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4, marginTop: -4 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-800)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
            </button>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-100)' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: activeTab === t.key ? 700 : 500,
                  color: activeTab === t.key ? 'var(--primary-600)' : 'var(--gray-500)',
                  borderBottom: activeTab === t.key ? '2px solid var(--primary-600)' : '2px solid transparent',
                  marginBottom: -2, transition: 'color 0.15s',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{TAB_ICONS[t.key]}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton animate-pulse" style={{ height: 56, background: 'var(--gray-100)', borderRadius: 8 }} />
              ))}
            </div>
          ) : !profile ? null : (

            /* ─────── OVERVIEW TAB ─────── */
            activeTab === 'overview' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Attendance */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                    Attendance Summary (This Month)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Present',    value: profile.attendanceSummary?.present,   color: '#059669', bg: '#D1FAE5', icon: 'check_circle' },
                      { label: 'Absent',     value: profile.attendanceSummary?.absent,    color: '#DC2626', bg: '#FEE2E2', icon: 'cancel' },
                      { label: 'Late',       value: profile.attendanceSummary?.late,      color: '#D97706', bg: '#FEF3C7', icon: 'schedule' },
                      { label: 'Early Exit', value: profile.attendanceSummary?.earlyExit, color: '#7C3AED', bg: '#F3E8FF', icon: 'directions_run' },
                    ].map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: s.bg, borderRadius: 10 }}>
                        <span className="material-symbols-outlined" style={{ color: s.color, fontSize: 20 }}>{s.icon}</span>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value ?? 0} <span style={{ fontSize: 10, fontWeight: 500 }}>days</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Productivity */}
                <div style={{ padding: 14, background: 'var(--gray-50)', borderRadius: 10, border: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary-600)', fontSize: 24 }}>hourglass_empty</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Working Hours (This Month)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-800)' }}>{profile.worklogSummary?.totalHours || 0} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-400)' }}>hrs</span></div>
                  </div>
                </div>

                {/* Leave Balance */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Leave Balance</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Emergency Leaves', used: profile.leaveBalance?.usedEmergency, allowed: profile.leaveBalance?.allowedEmergency, color: '#C2410C' },
                      { label: 'College Leaves',   used: profile.leaveBalance?.usedCollege,   allowed: profile.leaveBalance?.allowedCollege,   color: '#6D28D9' },
                    ].map(l => (
                      <div key={l.label} style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>{l.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: l.color }}>
                          {(l.allowed - l.used)} <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>/ {l.allowed} left</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTC */}
                {profile.salaryPreview && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Compensation (CTC)</div>
                    <div style={{ padding: 14, background: '#F0FDF4', borderRadius: 10, border: '1.5px solid #BBF7D0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5 }}>
                        {[
                          { label: 'Basic Salary',                  val: `₹${(profile.salaryPreview.basic || 0).toLocaleString()}`,     color: 'var(--gray-700)' },
                          { label: 'House Rent Allowance (HRA)',     val: `₹${(profile.salaryPreview.hra   || 0).toLocaleString()}`,     color: 'var(--gray-700)' },
                          { label: 'Dearness Allowance (DA)',        val: `₹${(profile.salaryPreview.da    || 0).toLocaleString()}`,     color: 'var(--gray-700)' },
                          { label: 'Standard Deductions',           val: `-₹${((profile.salaryPreview.pf || 0) + (profile.salaryPreview.tds || 0)).toLocaleString()}`, color: '#DC2626' },
                        ].map(r => (
                          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--gray-500)' }}>{r.label}</span>
                            <strong style={{ color: r.color }}>{r.val}</strong>
                          </div>
                        ))}
                        <hr style={{ border: 'none', borderTop: '1.5px dashed #BBF7D0', margin: '4px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                          <span style={{ color: '#16A34A', fontWeight: 700 }}>Estimated Net Payout</span>
                          <strong style={{ color: '#16A34A', fontWeight: 800 }}>₹{(profile.salaryPreview.net || 0).toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            /* ─────── PERSONAL INFO TAB ─────── */
            ) : activeTab === 'personal' ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Personal Details</div>
                <InfoRow label="Full Name"       value={profile.user?.name} />
                <InfoRow label="Email"           value={profile.user?.email} />
                <InfoRow label="Backup Email"    value={profile.user?.backupEmail} />
                <InfoRow label="Phone"           value={profile.user?.phone} />
                <InfoRow label="Gender"          value={profile.user?.gender} />
                <InfoRow label="Date of Joining" value={fmtDate(profile.user?.dateOfJoining)} />
                <InfoRow label="Address"         value={profile.user?.address} />
                <InfoRow label="Employee ID"     value={`#${profile.user?.empId}`} mono />
                <InfoRow label="Department"      value={`Space #${profile.user?.spaceId || '—'}`} mono />
                <InfoRow label="Status"          value={profile.user?.status} />
              </div>

            /* ─────── BANK DETAILS TAB ─────── */
            ) : activeTab === 'bank' ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Bank & Payment Details</div>
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                  Sensitive information — handle with care.
                </div>
                <InfoRow label="Account Holder Name" value={profile.bankDetails?.accountHolderName} />
                <InfoRow label="Bank Name"           value={profile.bankDetails?.bankName} />
                <InfoRow label="Account Number"      value={profile.bankDetails?.accountNumber} mono />
                <InfoRow label="IFSC Code"           value={profile.bankDetails?.ifscCode} mono />
                <InfoRow label="UPI ID"              value={profile.bankDetails?.upiId} mono />
              </div>

            /* ─────── DOCUMENTS TAB ─────── */
            ) : activeTab === 'documents' ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>
                  Uploaded Documents
                </div>
                {(!profile.documents || profile.documents.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--gray-400)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 10, opacity: 0.4 }}>folder_off</span>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>No documents uploaded</div>
                    <div style={{ fontSize: 12, marginTop: 4, color: 'var(--gray-300)' }}>The employee hasn't uploaded any documents yet.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {profile.documents.map((doc, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0',
                        borderRadius: 10, transition: 'box-shadow 0.15s'
                      }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--primary-600)' }}>
                            {DOC_ICONS[doc.documentType] || 'description'}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gray-800)' }}>{doc.documentType}</div>
                          {doc.documentNumber && (
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'JetBrains Mono', marginTop: 2 }}>{doc.documentNumber}</div>
                          )}
                        </div>
                        {doc.fileUrl && (
                          <a
                            href={`${BACKEND_ORIGIN}${doc.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--primary-600)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
                            title="View document"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                            View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
