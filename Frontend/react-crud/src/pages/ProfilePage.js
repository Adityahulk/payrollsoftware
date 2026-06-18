import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { profileApi } from '../api/profile';
import toast from 'react-hot-toast';
import ProfileImage from '../components/ProfileImage';

// ─── Constants ────────────────────────────────────────────────────────────────
const DOCUMENT_TYPES = [
  'PAN', 'Aadhar', 'Passport', 'Driving License',
  'Voter ID', 'Birth Certificate', 'Education Certificate', 'Other',
];

const MANDATORY_DOCS = ['PAN', 'Aadhar'];

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function FormField({ label, error, children, hint }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {error && <span className="form-error">{error}</span>}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3, display: 'block' }}>{hint}</span>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const { empId } = useParams();
  const location = useLocation();
  const targetEmpId = empId ? parseInt(empId, 10) : null;
  const isReadOnly = false;

  // ── State ──────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');

  // Personal info form
  const [personalForm, setPersonalForm] = useState({ name: '', phone: '', address: '', gender: '', backupEmail: '' });
  const [personalErrors, setPersonalErrors] = useState({});
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Change Password Modal
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  // Payment Details form
  const [paymentForm, setPaymentForm] = useState({
    accountNumber: '',
    bankName: '',
    accountHolderName: '',
    ifscCode: '',
    upiId: '',
  });
  const [paymentErrors, setPaymentErrors] = useState({});
  const [savingPayment, setSavingPayment] = useState(false);

  // Photo
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  // Documents
  const [docRows, setDocRows] = useState([
    { type: 'PAN', number: '', file: null, fileName: '' },
    { type: 'Aadhar', number: '', file: null, fileName: '' },
  ]);
  const [docErrors, setDocErrors] = useState({});
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [savedDocs, setSavedDocs] = useState([]);

  // ── Load Profile ───────────────────────────────────────────────────────────
  const loadProfile = useCallback(() => {
    setLoading(true);
    const fetchCall = targetEmpId 
      ? profileApi.getProfileByEmpId(targetEmpId)
      : profileApi.getMyProfile();

    fetchCall
      .then(r => {
        const p = r.data;
        setProfile(p);
        setPersonalForm({
          name: p.name || '',
          phone: p.phone || '',
          address: p.address || '',
          gender: p.gender || '',
          backupEmail: p.backupEmail || p.backupemail || '',
        });
        setPaymentForm({
          accountNumber: p.accountNumber || p.accountnumber || '',
          bankName: p.bankName || p.bankname || '',
          accountHolderName: p.accountHolderName || p.accountholdername || '',
          ifscCode: p.ifscCode || p.ifsccode || '',
          upiId: p.upiId || p.upiid || '',
        });
        if (p.profilePhotoUrl || p.profilephotourl) {
          setPhotoPreview(profileApi.getFileUrl(p.profilePhotoUrl || p.profilephotourl));
        } else {
          setPhotoPreview(null);
        }
        if (p.documents?.length) {
          setSavedDocs(p.documents);
          // Pre-fill mandatory rows from saved data
          const rows = [...MANDATORY_DOCS].map(type => {
            const existing = p.documents.find(d =>
              d.documentType?.toUpperCase() === type.toUpperCase() ||
              d.documenttype?.toUpperCase() === type.toUpperCase()
            );
            return {
              type,
              number: existing?.documentNumber || existing?.documentnumber || '',
              file: null,
              fileName: existing?.fileUrl || existing?.fileurl ? '(already uploaded)' : '',
            };
          });
          // Add extra docs beyond mandatory
          const extras = p.documents.filter(d => {
            const dt = d.documentType || d.documenttype || '';
            return !MANDATORY_DOCS.map(m => m.toUpperCase()).includes(dt.toUpperCase());
          });
          extras.forEach(d => rows.push({
            type: d.documentType || d.documenttype,
            number: d.documentNumber || d.documentnumber || '',
            file: null,
            fileName: '(already uploaded)',
          }));
          setDocRows(rows);
        } else {
          setSavedDocs([]);
          setDocRows([
            { type: 'PAN', number: '', file: null, fileName: '' },
            { type: 'Aadhar', number: '', file: null, fileName: '' },
          ]);
        }
      })
      .catch((err) => console.warn('Failed to load profile silently', err))
      .finally(() => setLoading(false));
  }, [targetEmpId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (location.state?.openChangePassword) {
      setChangePasswordModal(true);
      // Clean up router state so refreshing doesn't reopen the modal
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // ── Personal Info Submit ───────────────────────────────────────────────────
  const validatePersonal = () => {
    const e = {};
    if (!personalForm.name?.trim()) e.name = 'Name is required';
    if (!personalForm.phone?.trim()) e.phone = 'Phone is required';
    else if (!/^\+?[\d\s-]{10,15}$/.test(personalForm.phone.trim())) e.phone = 'Enter a valid phone number';
    if (!personalForm.gender) e.gender = 'Select a gender';
    if (personalForm.backupEmail?.trim() && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(personalForm.backupEmail.trim())) {
      e.backupEmail = 'Enter a valid backup email address';
    }
    setPersonalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!validatePersonal()) return;
    setSavingPersonal(true);
    try {
      await profileApi.updateProfile(personalForm, targetEmpId);
      if (personalForm.backupEmail) {
        await profileApi.updateBackupEmail(personalForm.backupEmail);
      }
      toast.success('✅ Profile updated successfully!');
      setProfile(prev => ({ ...prev, ...personalForm }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!changePasswordForm.oldPassword || !changePasswordForm.newPassword || !changePasswordForm.confirmPassword) {
      toast.error('All password fields are required!');
      return;
    }
    if (changePasswordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long!');
      return;
    }
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      toast.error('Passwords do not match!');
      return;
    }
    setChangingPassword(true);
    try {
      await profileApi.changePassword(changePasswordForm.oldPassword, changePasswordForm.newPassword);
      toast.success('✅ Password changed successfully!');
      setChangePasswordModal(false);
      setChangePasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password. Please check old password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Payment Details Submit ─────────────────────────────────────────────────
  const validatePayment = () => {
    const e = {};
    if (paymentForm.ifscCode?.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(paymentForm.ifscCode.trim().toUpperCase())) {
      e.ifscCode = 'Enter a valid 11-digit IFSC code (e.g. SBIN0001234)';
    }
    if (paymentForm.upiId?.trim() && !/^[\w.\-_]+@[\w.\-_]+$/.test(paymentForm.upiId.trim())) {
      e.upiId = 'Enter a valid UPI ID (e.g. user@ybl)';
    }
    setPaymentErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!validatePayment()) return;
    setSavingPayment(true);
    try {
      await profileApi.updateProfile(paymentForm, targetEmpId);
      toast.success('✅ Payment details updated successfully!');
      setProfile(prev => ({ ...prev, ...paymentForm }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update payment details');
    } finally {
      setSavingPayment(false);
    }
  };

  // ── Photo Upload ───────────────────────────────────────────────────────────
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP images allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    try {
      const r = await profileApi.uploadPhoto(photoFile);
      setPhotoPreview(profileApi.getFileUrl(r.data.photoUrl));
      setPhotoFile(null);
      toast.success('✅ Profile photo updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Document Rows ──────────────────────────────────────────────────────────
  const addDocRow = () => {
    const usedTypes = docRows.map(r => r.type);
    const available = DOCUMENT_TYPES.filter(t => !usedTypes.includes(t));
    if (available.length === 0) { toast('All document types already added'); return; }
    setDocRows(prev => [...prev, { type: available[0], number: '', file: null, fileName: '' }]);
  };

  const removeDocRow = (idx) => {
    if (docRows[idx]?.type && MANDATORY_DOCS.includes(docRows[idx].type)) {
      toast.error(`${docRows[idx].type} is mandatory and cannot be removed`);
      return;
    }
    setDocRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDocRow = (idx, field, value) => {
    setDocRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    setDocErrors(prev => { const e = { ...prev }; delete e[`${idx}_${field}`]; return e; });
  };

  const handleDocFile = (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return; }
    updateDocRow(idx, 'file', file);
    updateDocRow(idx, 'fileName', file.name);
  };

  // ── Conditional mandatory flags ─────────────────────────────────────────
  const existingTypes = savedDocs.map(d => (d.documentType || d.documenttype || '').toUpperCase());
  const isPanRequired = !existingTypes.includes('PAN');
  const isAadharRequired = !existingTypes.includes('AADHAR');

  // ── Document Validation ────────────────────────────────────────────────────
  const validateDocs = () => {
    const e = {};
    const types = docRows.map(r => r.type);

    // Only require PAN/Aadhar if they don't already exist in saved docs
    if (isPanRequired && !types.includes('PAN')) e.mandatory = 'PAN document is required';
    if (isAadharRequired && !types.includes('Aadhar')) {
      e.mandatory = e.mandatory
        ? 'PAN and Aadhar documents are required'
        : 'Aadhar document is required';
    }

    // Check duplicates
    const uniq = new Set(types);
    if (uniq.size !== types.length) e.duplicates = 'Duplicate document types are not allowed';

    docRows.forEach((row, i) => {
      if (!row.number.trim()) e[`${i}_number`] = 'Document number is required';
      if (!row.file && !row.fileName?.includes('already uploaded')) {
        e[`${i}_file`] = 'Upload a file for this document';
      }
    });

    setDocErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Document Submit ────────────────────────────────────────────────────────
  const handleSubmitDocs = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!validateDocs()) {
      toast.error('Please fix errors before submitting');
      return;
    }

    // Only submit rows with an actual new file
    const rowsToUpload = docRows.filter(r => r.file !== null);
    if (rowsToUpload.length === 0) {
      toast('No new documents to upload');
      return;
    }

    setUploadingDocs(true);
    try {
      await profileApi.uploadDocuments(rowsToUpload.map(r => ({
        type: r.type,
        number: r.number,
        file: r.file,
      })));
      toast.success('✅ Documents saved successfully!');
      loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Document upload failed');
    } finally {
      setUploadingDocs(false);
    }
  };

  // ── Delete saved doc ───────────────────────────────────────────────────────
  const handleDeleteSavedDoc = async (doc) => {
    const docId = doc.docId || doc.docid;
    if (!window.confirm(`Delete ${doc.documentType || doc.documenttype}?`)) return;
    try {
      await profileApi.deleteDocument(docId);
      toast.success('Document deleted');
      loadProfile();
    } catch {
      toast.error('Failed to delete document');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout role={user?.role?.toLowerCase() === 'admin' ? 'admin' : 'employee'}>
        <div className="page-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="card" style={{ height: 160, animation: 'pulse 1.5s infinite', background: 'var(--gray-50)' }} />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  const tabRole = user?.role?.toLowerCase() === 'admin' ? 'admin' : 'employee';
  const completeness = (() => {
    let done = 0, total = 5;
    if (profile?.name) done++;
    if (profile?.phone) done++;
    if (profile?.address) done++;
    if (profile?.gender) done++;
    if (savedDocs.length >= 2) done++;
    return Math.round((done / total) * 100);
  })();

  return (
    <AppLayout role={tabRole}>
      <div className="page-content fade-in">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>My Profile</h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              {isReadOnly ? 'View-only profile (Admin)' : 'Manage your personal info, photo, and documents'}
            </p>
          </div>
          {isReadOnly && (
            <span className="badge badge-warning" style={{ fontSize: 12, padding: '6px 14px' }}>
              🔒 View Only
            </span>
          )}
        </div>

        {/* ── Profile Completion Banner ────────────────────────────────────── */}
        {!isReadOnly && (
          <div className="card" style={{ marginBottom: 24, background: completeness >= 100 ? '#F0FDF4' : 'var(--surface)', border: completeness >= 100 ? '1px solid #86EFAC' : '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Profile Completeness — {completeness}%
                {completeness >= 100 && ' 🎉'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                {completeness < 100 ? 'Fill in all sections to complete your profile' : 'Profile is complete!'}
              </span>
            </div>
            <div style={{ background: 'var(--gray-100)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{
                width: `${completeness}%`, height: '100%',
                background: completeness >= 100 ? '#10B981' : 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                borderRadius: 999, transition: 'width 0.8s ease'
              }} />
            </div>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="tabs" style={{ marginBottom: 24 }}>
          {[
            ['personal', 'person', 'Personal Info'],
            ['photo', 'photo_camera', 'Profile Photo'],
            ['documents', 'folder_open', 'Documents'],
            ['payment', 'account_balance', 'Payment Details'],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              className={`tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>{icon}</span>
              {label}
              {key === 'documents' && savedDocs.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#4F46E5', color: '#fff', borderRadius: 99, padding: '1px 6px' }}>
                  {savedDocs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1 — PERSONAL INFO
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'personal' && (
          <div className="grid grid-2" style={{ gap: 20, alignItems: 'start' }}>

            {/* Form */}
            <div className="card">
              <SectionHeader icon="person" title="Personal Information" subtitle="Update your contact and personal details" />
              <form onSubmit={handleSavePersonal} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <FormField label="Full Name *" error={personalErrors.name}>
                  <input
                    className={`form-input ${personalErrors.name ? 'input-error' : ''}`}
                    placeholder="Your full name"
                    value={personalForm.name}
                    onChange={e => setPersonalForm(f => ({ ...f, name: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField label="Email" hint="Email cannot be changed">
                  <input
                    className="form-input"
                    value={profile?.email || ''}
                    disabled
                    style={{ opacity: .6, cursor: 'not-allowed' }}
                  />
                </FormField>

                <FormField label="Phone *" error={personalErrors.phone}>
                  <input
                    className={`form-input ${personalErrors.phone ? 'input-error' : ''}`}
                    placeholder="+91 98765 43210"
                    value={personalForm.phone}
                    onChange={e => setPersonalForm(f => ({ ...f, phone: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField label="Backup Email" error={personalErrors.backupEmail}>
                  <input
                    type="email"
                    className={`form-input ${personalErrors.backupEmail ? 'input-error' : ''}`}
                    placeholder="backup@example.com"
                    value={personalForm.backupEmail || ''}
                    onChange={e => setPersonalForm(f => ({ ...f, backupEmail: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField label="Gender *" error={personalErrors.gender}>
                  <select
                    className={`form-select ${personalErrors.gender ? 'input-error' : ''}`}
                    value={personalForm.gender}
                    onChange={e => setPersonalForm(f => ({ ...f, gender: e.target.value }))}
                    disabled={isReadOnly}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </FormField>

                <FormField label="Address">
                  <textarea
                    className="form-input"
                    placeholder="Your home address..."
                    rows={3}
                    value={personalForm.address}
                    onChange={e => setPersonalForm(f => ({ ...f, address: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                {!isReadOnly && (
                  <button type="submit" className="btn btn-primary" disabled={savingPersonal} style={{ justifyContent: 'center' }}>
                    {savingPersonal
                      ? <><div className="spinner" />Saving...</>
                      : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>Save Changes</>
                    }
                  </button>
                )}
              </form>
            </div>

            {/* Info card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <SectionHeader icon="badge" title="Account Info" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Employee ID', value: `#${profile?.empId || user?.empId}` },
                    { label: 'Role', value: profile?.role || user?.role },
                    { label: 'Status', value: profile?.status },
                    { label: 'Date of Joining', value: profile?.dateOfJoining || profile?.dateofjoining
                      ? new Date(profile.dateOfJoining || profile.dateofjoining).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                      : '—'
                    },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {item.label === 'Status'
                          ? <span className={`badge badge-${item.value === 'Active' ? 'success' : item.value === 'Pending' ? 'warning' : 'error'}`}>{item.value}</span>
                          : item.value || '—'
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Settings */}
              <div className="card">
                <SectionHeader icon="lock" title="Security Settings" subtitle="Keep your account secure" />
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setChangePasswordModal(true)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock_reset</span>
                  Change Password
                </button>
              </div>

              {/* Quick checklist */}
              <div className="card">
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Profile Checklist</h4>
                {[
                  ['Name', !!profile?.name],
                  ['Phone', !!profile?.phone],
                  ['Address', !!profile?.address],
                  ['Gender', !!profile?.gender],
                  ['Photo', !!(profile?.profilePhotoUrl || profile?.profilephotourl)],
                  ['PAN', savedDocs.some(d => (d.documentType || d.documenttype)?.toUpperCase() === 'PAN')],
                  ['Aadhar', savedDocs.some(d => (d.documentType || d.documenttype)?.toUpperCase() === 'AADHAR')],
                  ['Bank Details', !!(profile?.accountNumber || profile?.accountnumber)],
                  ['UPI Routing', !!(profile?.upiId || profile?.upiid)],
                ].map(([label, done]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: done ? '#10B981' : '#D1D5DB' }}>
                      {done ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span style={{ fontSize: 13, color: done ? 'var(--gray-700)' : 'var(--gray-400)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2 — PROFILE PHOTO
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'photo' && (
          <div className="grid grid-2" style={{ gap: 20, alignItems: 'start' }}>
            <div className="card">
              <SectionHeader icon="photo_camera" title="Profile Photo" subtitle="Upload a clear headshot photo" />

              {/* Photo Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{
                  width: 160, height: 160, borderRadius: '50%',
                  border: '4px solid var(--primary-200)',
                  overflow: 'hidden', background: 'var(--gray-100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {(profile?.empId || profile?.empid) ? (
                    <ProfileImage
                      empId={profile?.empId || profile?.empid}
                      previewUrl={photoFile ? photoPreview : null}
                      hasPhoto={!!(profile?.profilePhotoUrl || profile?.profilephotourl || photoFile)}
                    />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'var(--gray-300)' }}>person</span>
                  )}
                </div>

                {!isReadOnly && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>
                      Choose Photo
                    </button>
                    {photoFile && (
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleUploadPhoto}
                        disabled={uploadingPhoto}
                      >
                        {uploadingPhoto
                          ? <><div className="spinner" />Uploading...</>
                          : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_upload</span>Upload Photo</>
                        }
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handlePhotoSelect}
                />
              </div>

              {photoFile && (
                <div style={{ padding: 12, background: '#EEF2FF', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#4F46E5' }}>image</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{photoFile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{(photoFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Photo Requirements</h4>
              {[
                ['check', 'JPEG, PNG, or WebP format'],
                ['check', 'Maximum size: 5 MB'],
                ['check', 'Clear, front-facing headshot'],
                ['check', 'Plain or professional background'],
                ['close', 'No group photos'],
                ['close', 'No blurry images'],
              ].map(([icon, text], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: icon === 'check' ? '#10B981' : '#EF4444' }}>
                    {icon === 'check' ? 'check_circle' : 'cancel'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3 — DOCUMENTS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'documents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Saved Documents */}
            {savedDocs.length > 0 && (
              <div className="card">
                <SectionHeader icon="verified" title="Uploaded Documents" subtitle="Documents saved in the system" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {savedDocs.map(doc => {
                    const type = doc.documentType || doc.documenttype;
                    const number = doc.documentNumber || doc.documentnumber;
                    const url = doc.fileUrl || doc.fileurl;
                    const docId = doc.docId || doc.docid;
                    const isMandatory = MANDATORY_DOCS.map(m => m.toUpperCase()).includes(type?.toUpperCase());
                    return (
                      <div key={docId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderRadius: 10, background: isMandatory ? '#F0FDF4' : 'var(--gray-50)',
                        border: isMandatory ? '1px solid #86EFAC' : '1px solid var(--gray-100)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 24, color: isMandatory ? '#10B981' : '#4F46E5' }}>{isMandatory ? 'verified' : 'description'}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {type}
                              {isMandatory && (
                                <span style={{ fontSize: 9, fontWeight: 800, background: '#10B981', color: '#fff', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>✓ UPLOADED</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>#{number}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {url && (
                            <a
                              href={profileApi.getFileUrl(url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                              View
                            </a>
                          )}
                          {!isReadOnly && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--error)' }}
                              onClick={() => handleDeleteSavedDoc(doc)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upload Form */}
            {!isReadOnly && (
              <div className="card">
                <SectionHeader icon="upload_file" title="Upload / Update Documents" subtitle="PAN and Aadhar are mandatory" />

                {/* Validation Errors */}
                {(docErrors.mandatory || docErrors.duplicates) && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10 }}>
                    {docErrors.mandatory && <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>⚠️ {docErrors.mandatory}</div>}
                    {docErrors.duplicates && <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>⚠️ {docErrors.duplicates}</div>}
                  </div>
                )}

                <form onSubmit={handleSubmitDocs}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {docRows.map((row, idx) => {
                      const isMandatory = MANDATORY_DOCS.includes(row.type);
                      const isAlreadySaved = existingTypes.includes(row.type.toUpperCase());
                      const isStillRequired = isMandatory && !isAlreadySaved;
                      const usedTypes = docRows.filter((_, i) => i !== idx).map(r => r.type);
                      const availableTypes = DOCUMENT_TYPES.filter(t => !usedTypes.includes(t) || t === row.type);

                      return (
                        <div key={idx} style={{
                          padding: 16, borderRadius: 12,
                          border: isStillRequired ? '2px solid #FCA5A5' : isMandatory && isAlreadySaved ? '2px solid #86EFAC' : '1px solid var(--gray-100)',
                          background: isStillRequired ? '#FEF2F2' : isMandatory && isAlreadySaved ? '#F0FDF4' : 'var(--surface)',
                          position: 'relative',
                        }}>
                          {isMandatory && (
                            <div style={{
                              position: 'absolute', top: -1, right: 12, fontSize: 9, fontWeight: 800,
                              background: isAlreadySaved ? '#10B981' : '#EF4444',
                              color: '#fff', padding: '2px 6px', borderRadius: '0 0 6px 6px',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              {isAlreadySaved ? '✓ UPLOADED — UPDATE OPTIONAL' : '❗ REQUIRED'}
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                            <FormField label="Document Type *">
                              <select
                                className="form-select"
                                value={row.type}
                                onChange={e => updateDocRow(idx, 'type', e.target.value)}
                                disabled={isMandatory}
                              >
                                {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </FormField>

                            <FormField label="Document Number *" error={docErrors[`${idx}_number`]}>
                              <input
                                className={`form-input ${docErrors[`${idx}_number`] ? 'input-error' : ''}`}
                                placeholder={row.type === 'PAN' ? 'ABCDE1234F' : row.type === 'Aadhar' ? '1234 5678 9012' : 'Document number'}
                                value={row.number}
                                onChange={e => updateDocRow(idx, 'number', e.target.value)}
                              />
                            </FormField>

                            <FormField label={`Upload File * ${row.fileName ? `(${row.fileName})` : ''}`} error={docErrors[`${idx}_file`]}>
                              <label style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 12px', borderRadius: 8,
                                border: `1px dashed ${docErrors[`${idx}_file`] ? 'var(--error)' : 'var(--gray-300)'}`,
                                cursor: 'pointer', fontSize: 13, color: 'var(--gray-500)',
                                background: 'var(--surface)', transition: 'border-color .15s',
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                                {row.fileName || 'Choose file (PDF, JPG, PNG)'}
                                <input
                                  type="file"
                                  style={{ display: 'none' }}
                                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                                  onChange={e => handleDocFile(idx, e)}
                                />
                              </label>
                            </FormField>

                            <div style={{ paddingBottom: 2 }}>
                              {!isMandatory && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => removeDocRow(idx)}
                                  title="Remove"
                                  style={{ color: 'var(--error)' }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>remove_circle</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addDocRow}
                      disabled={docRows.length >= DOCUMENT_TYPES.length}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                      Add Document
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={uploadingDocs}
                    >
                      {uploadingDocs
                        ? <><div className="spinner" />Uploading...</>
                        : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_upload</span>Save Documents</>
                      }
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4 — PAYMENT DETAILS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payment' && (
          <div className="grid grid-2" style={{ gap: 20, alignItems: 'start' }}>
            <div className="card">
              <SectionHeader icon="account_balance" title="Bank & Payment Details" subtitle="Configure banking coordinates for salary payments" />
              <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <FormField label="Account Holder Name" error={paymentErrors.accountHolderName} hint="Name matching the bank account registry">
                  <input
                    className={`form-input ${paymentErrors.accountHolderName ? 'input-error' : ''}`}
                    placeholder="e.g. John Doe"
                    value={paymentForm.accountHolderName}
                    onChange={e => setPaymentForm(f => ({ ...f, accountHolderName: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField label="Bank Name" error={paymentErrors.bankName}>
                  <input
                    className={`form-input ${paymentErrors.bankName ? 'input-error' : ''}`}
                    placeholder="e.g. HDFC Bank"
                    value={paymentForm.bankName}
                    onChange={e => setPaymentForm(f => ({ ...f, bankName: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField label="Account Number" error={paymentErrors.accountNumber}>
                  <input
                    className={`form-input ${paymentErrors.accountNumber ? 'input-error' : ''}`}
                    placeholder="e.g. 50100234567890"
                    value={paymentForm.accountNumber}
                    onChange={e => setPaymentForm(f => ({ ...f, accountNumber: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField label="IFSC Code" error={paymentErrors.ifscCode} hint="11-digit alphanumeric bank branch code">
                  <input
                    className={`form-input ${paymentErrors.ifscCode ? 'input-error' : ''}`}
                    placeholder="e.g. HDFC0000123"
                    value={paymentForm.ifscCode}
                    onChange={e => setPaymentForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField label="UPI ID" error={paymentErrors.upiId} hint="For direct UPI routing (e.g. username@bank)">
                  <input
                    className={`form-input ${paymentErrors.upiId ? 'input-error' : ''}`}
                    placeholder="e.g. johndoe@okaxis"
                    value={paymentForm.upiId}
                    onChange={e => setPaymentForm(f => ({ ...f, upiId: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </FormField>

                {!isReadOnly && (
                  <button type="submit" className="btn btn-primary" disabled={savingPayment} style={{ justifyContent: 'center' }}>
                    {savingPayment
                      ? <><div className="spinner" />Saving...</>
                      : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>Save Payment Details</>
                    }
                  </button>
                )}
              </form>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Payment Readiness Check */}
              <div className="card">
                <SectionHeader icon="fact_check" title="Payment Readiness" subtitle="Validation flags for digital payout routing" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* UPI Routing Status */}
                  <div style={{
                    padding: 16, borderRadius: 12,
                    border: paymentForm.upiId?.trim() ? '1px solid #86EFAC' : '1px solid var(--gray-200)',
                    background: paymentForm.upiId?.trim() ? '#F0FDF4' : 'var(--gray-50)',
                  }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span className="material-symbols-outlined" style={{
                        color: paymentForm.upiId?.trim() ? '#10B981' : 'var(--gray-400)',
                        fontSize: 24
                      }}>
                        {paymentForm.upiId?.trim() ? 'check_circle' : 'pending'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: paymentForm.upiId?.trim() ? '#166534' : 'var(--gray-700)' }}>
                          {paymentForm.upiId?.trim() ? 'UPI Routing: READY' : 'UPI Routing: INCOMPLETE'}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, lineHeight: 1.4 }}>
                          {paymentForm.upiId?.trim() 
                            ? `UPI payments will route to ${paymentForm.upiId}` 
                            : 'UPI payouts require a valid UPI ID (only supported for single employee transfers)'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Razorpay Routing Status */}
                  {(() => {
                    const hasBankDetails = paymentForm.accountNumber?.trim() && 
                                           paymentForm.bankName?.trim() && 
                                           paymentForm.accountHolderName?.trim() && 
                                           paymentForm.ifscCode?.trim();
                    return (
                      <div style={{
                        padding: 16, borderRadius: 12,
                        border: hasBankDetails ? '1px solid #86EFAC' : '1px solid var(--gray-200)',
                        background: hasBankDetails ? '#F0FDF4' : 'var(--gray-50)',
                      }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span className="material-symbols-outlined" style={{
                            color: hasBankDetails ? '#10B981' : 'var(--gray-400)',
                            fontSize: 24
                          }}>
                            {hasBankDetails ? 'check_circle' : 'pending'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: hasBankDetails ? '#166534' : 'var(--gray-700)' }}>
                              {hasBankDetails ? 'Razorpay Routing: READY' : 'Razorpay Routing: INCOMPLETE'}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, lineHeight: 1.4 }}>
                              {hasBankDetails 
                                ? 'Bank Account Details are complete. Razorpay order payouts enabled.' 
                                : 'Razorpay bank transfer payouts require Account Number, Bank Name, Account Holder Name, and IFSC Code.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Cash Payout Status */}
                  <div style={{
                    padding: 16, borderRadius: 12,
                    border: '1px solid #86EFAC',
                    background: '#F0FDF4',
                  }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span className="material-symbols-outlined" style={{ color: '#10B981', fontSize: 24 }}>
                        check_circle
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>
                          Cash Routing: ALWAYS READY
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, lineHeight: 1.4 }}>
                          Manual Cash payouts are supported without any prerequisite bank details.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {changePasswordModal && (
          <Modal title="Change Password" onClose={() => setChangePasswordModal(false)}>
            <form onSubmit={handleChangePasswordSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Old Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    required
                    value={changePasswordForm.oldPassword}
                    onChange={e => setChangePasswordForm(p => ({ ...p, oldPassword: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={changePasswordForm.newPassword}
                    onChange={e => setChangePasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    value={changePasswordForm.confirmPassword}
                    onChange={e => setChangePasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setChangePasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={changingPassword}>
                  {changingPassword ? <div className="spinner" /> : 'Update Password'}
                </button>
              </div>
            </form>
          </Modal>
        )}

      </div>
    </AppLayout>
  );
}

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
