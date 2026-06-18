import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { getPayslipSettings, savePayslipSettings } from '../api/settings';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';
import PayslipTemplateRenderer from '../components/PayslipTemplateRenderer';

const mockPayslipData = {
  month: 6,
  year: 2026,
  employeeName: 'Jane Smith',
  employeeId: '10042',
  spaceId: '3',
  paymentMethod: 'Bank Transfer',
  transactionId: 'TXN8765432109',
  bankName: 'HDFC Bank',
  accountNumber: 'XXXXXXXX5543',
  ifscCode: 'HDFC0000123',
  upiId: 'janesmith@upi',
  daysPresent: 20,
  totalWorkingDays: 22,
  leaveDays: 2,
  overtimeHours: 6,
  basic: 45000,
  allowances: [
    { name: 'House Rent Allowance (HRA)', amount: 18000 },
    { name: 'Dearness Allowance (DA)', amount: 5000 },
    { name: 'Incentive', amount: 4500 }
  ],
  deductions: [
    { name: 'Provident Fund (PF)', amount: 5400 },
    { name: 'Professional Tax', amount: 200 },
    { name: 'TDS (Income Tax)', amount: 3600 },
    { name: 'Penalty: Work Impact / Late Clock-in', amount: 150 }
  ]
};

export default function PayslipSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [templateSelector, setTemplateSelector] = useState('Classic');
  const [tableType, setTableType] = useState('Standard');
  const [signatoryName, setSignatoryName] = useState('');
  const [footerText, setFooterText] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  // Toggles
  const [showBaseSalary, setShowBaseSalary] = useState(true);
  const [showAllowances, setShowAllowances] = useState(true);
  const [showDeductions, setShowDeductions] = useState(true);
  const [showAttendance, setShowAttendance] = useState(true);
  const [showLeaveStats, setShowLeaveStats] = useState(true);
  const [showOvertime, setShowOvertime] = useState(true);
  const [showTaxDetails, setShowTaxDetails] = useState(true);
  const [showSignature, setShowSignature] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getPayslipSettings();
      setCompanyName(data.companyName || '');
      setLogoUrl(data.logoUrl || '');
      if (data.logoUrl) {
        // Strip duplicate api prefix if present in baseURL
        const cleanBaseUrl = API_BASE_URL.endsWith('/api') 
          ? API_BASE_URL.slice(0, -4) 
          : API_BASE_URL;
        setLogoPreview(`${cleanBaseUrl}${data.logoUrl}`);
      }
      // Normalize 'Default' (old DB value) to 'Classic'
      const tmpl = data.templateSelector || 'Classic';
      setTemplateSelector(tmpl === 'Default' ? 'Classic' : tmpl);
      setTableType(data.tableType || 'Standard');
      setSignatoryName(data.signatoryName || '');
      setFooterText(data.footerText || '');
      setContactEmail(data.contactEmail || '');
      setContactPhone(data.contactPhone || '');
      setCompanyAddress(data.companyAddress || '');

      setShowBaseSalary(data.showBaseSalary ?? true);
      setShowAllowances(data.showAllowances ?? true);
      setShowDeductions(data.showDeductions ?? true);
      setShowAttendance(data.showAttendance ?? true);
      setShowLeaveStats(data.showLeaveStats ?? true);
      setShowOvertime(data.showOvertime ?? true);
      setShowTaxDetails(data.showTaxDetails ?? true);
      setShowSignature(data.showSignature ?? true);
    } catch (err) {
      toast.error('Failed to load payslip settings.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo file size must be less than 2MB.');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('CompanyName', companyName);
      formData.append('TemplateSelector', templateSelector);
      formData.append('TableType', tableType);
      formData.append('ShowBaseSalary', showBaseSalary);
      formData.append('ShowAllowances', showAllowances);
      formData.append('ShowDeductions', showDeductions);
      formData.append('ShowAttendance', showAttendance);
      formData.append('ShowLeaveStats', showLeaveStats);
      formData.append('ShowOvertime', showOvertime);
      formData.append('ShowTaxDetails', showTaxDetails);
      formData.append('ShowSignature', showSignature);
      formData.append('SignatoryName', signatoryName);
      formData.append('FooterText', footerText);
      formData.append('ContactEmail', contactEmail);
      formData.append('ContactPhone', contactPhone);
      formData.append('CompanyAddress', companyAddress);

      if (logoFile) {
        formData.append('LogoFile', logoFile);
      }

      const updated = await savePayslipSettings(formData);
      toast.success('Payslip settings updated successfully!');
      
      setLogoUrl(updated.logoUrl || '');
      if (updated.logoUrl) {
        const cleanBaseUrl = API_BASE_URL.endsWith('/api') 
          ? API_BASE_URL.slice(0, -4) 
          : API_BASE_URL;
        setLogoPreview(`${cleanBaseUrl}${updated.logoUrl}`);
      }
      setLogoFile(null);
    } catch (err) {
      toast.error('Failed to save payslip settings.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout role="admin">
      <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Header Title Card */}
        <div className="card" style={{ 
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', 
          color: '#FFF', 
          padding: '24px 32px', 
          borderRadius: '16px',
          marginBottom: '24px',
          boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>settings_applications</span>
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>Payslip Settings</h1>
              <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '14px' }}>Customize your corporate branding, toggle visible sections, and choose styling layouts for employee payslips.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 32, height: 32, border: '3px solid #E5E7EB',
              borderTopColor: '#4F46E5', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>Loading configuration...</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px', alignItems: 'start' }}>
            
            {/* Left Column: Form Settings */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Row 1: Brand details & Layout */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Card A: Branding & Company Info */}
                <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                    <span className="material-symbols-outlined" style={{ color: '#4F46E5' }}>domain</span>
                    Company & Brand
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Logo uploader */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Company Logo</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '12px',
                          border: '2px dashed #D1D5DB',
                          background: '#F9FAFB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#9CA3AF' }}>image</span>
                          )}
                        </div>
                        <div>
                          <input
                            type="file"
                            id="logo-file-input"
                            accept="image/*"
                            onChange={handleLogoChange}
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('logo-file-input').click()}
                            style={{
                              padding: '8px 16px',
                              background: '#FFF',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#374151',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#C5C9D0'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                          >
                            Choose Logo
                          </button>
                          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6B7280' }}>Max size: 2MB. Supports PNG, JPG, SVG.</p>
                        </div>
                      </div>
                    </div>

                    {/* Company Name */}
                    <div>
                      <label htmlFor="company-name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Company Name</label>
                      <input
                        id="company-name"
                        type="text"
                        className="form-control"
                        placeholder="e.g. Microtechnique Corp"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                      />
                    </div>

                    {/* Company Address */}
                    <div>
                      <label htmlFor="company-address" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Address</label>
                      <textarea
                        id="company-address"
                        rows={2}
                        className="form-control"
                        placeholder="Enter company registered address"
                        value={companyAddress}
                        onChange={e => setCompanyAddress(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', resize: 'vertical' }}
                      />
                    </div>

                    {/* Contacts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label htmlFor="contact-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>HR Email</label>
                        <input
                          id="contact-email"
                          type="email"
                          placeholder="hr@company.com"
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-phone" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>HR Phone</label>
                        <input
                          id="contact-phone"
                          type="text"
                          placeholder="+91 XXXXX XXXXX"
                          value={contactPhone}
                          onChange={e => setContactPhone(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Card B: Layout Templates & Design */}
                <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                    <span className="material-symbols-outlined" style={{ color: '#4F46E5' }}>palette</span>
                    Layout & Style
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Template Selector */}
                    <div>
                      <label htmlFor="template-selector" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Payslip Template Layout</label>
                      <select
                        id="template-selector"
                        value={templateSelector}
                        onChange={e => setTemplateSelector(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFF' }}
                      >
                        <option value="Classic">Classic Corporate Template</option>
                        <option value="Modern">Modern Minimalist Template</option>
                        <option value="Compact">Compact Streamlined Template</option>
                      </select>
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#6B7280' }}>Alters the overall design motif, color accents, and headers on the PDF and web views.</p>
                    </div>

                    {/* Table Type Selector */}
                    <div>
                      <label htmlFor="table-type" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Breakdown Table Format</label>
                      <select
                        id="table-type"
                        value={tableType}
                        onChange={e => setTableType(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFF' }}
                      >
                        <option value="Standard">Standard (Allowances Left / Deductions Right)</option>
                        <option value="Compact">Compact Summary Table</option>
                        <option value="Grid">Structured Grid Table</option>
                        <option value="Minimalist">Minimalist Borderless List</option>
                      </select>
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#6B7280' }}>Changes how earnings and deductions are mapped in the calculation tables.</p>
                    </div>

                    <div style={{
                      background: '#EEF2FF',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #C7D2FE',
                      display: 'flex',
                      gap: '12px'
                    }}>
                      <span className="material-symbols-outlined" style={{ color: '#4F46E5', fontSize: '20px' }}>info</span>
                      <p style={{ margin: 0, fontSize: '12px', color: '#3730A3', lineHeight: '1.5' }}>
                        These styling values are stored dynamically and will govern how payslip elements render. The PDF generator reads these options before rendering.
                      </p>
                    </div>

                  </div>
                </div>

              </div>

              {/* Row 2: Visibility Toggles */}
              <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                  <span className="material-symbols-outlined" style={{ color: '#4F46E5' }}>visibility</span>
                  Content Visibility Toggles
                </h3>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '-10px 0 24px' }}>Control what sections and numbers are printed in the employee's final payslip document.</p>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                  gap: '20px'
                }}>
                  {[
                    { state: showBaseSalary, setState: setShowBaseSalary, label: 'Base Salary', desc: 'Show basic salary item' },
                    { state: showAllowances, setState: setShowAllowances, label: 'Allowances Breakdown', desc: 'List all active allowances' },
                    { state: showDeductions, setState: setShowDeductions, label: 'Deductions Breakdown', desc: 'List standard deductions' },
                    { state: showAttendance, setState: setShowAttendance, label: 'Attendance Days', desc: 'Show present/working days' },
                    { state: showLeaveStats, setState: setShowLeaveStats, label: 'Leave Summary', desc: 'Print approved monthly leaves' },
                    { state: showOvertime, setState: setShowOvertime, label: 'Overtime Details', desc: 'Print overtime hours worked' },
                    { state: showTaxDetails, setState: setShowTaxDetails, label: 'TDS & PF Details', desc: 'Include tax details columns' },
                    { state: showSignature, setState: setShowSignature, label: 'Signature Section', desc: 'Render authorized signature box' },
                  ].map((toggle, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '12px', 
                      background: '#F9FAFB', 
                      padding: '12px', 
                      borderRadius: '8px',
                      border: '1px solid #F3F4F6'
                    }}>
                      <input
                        type="checkbox"
                        checked={toggle.state}
                        onChange={e => toggle.setState(e.target.checked)}
                        style={{ 
                          width: '16px', 
                          height: '16px', 
                          accentColor: '#4F46E5', 
                          marginTop: '3px',
                          cursor: 'pointer'
                        }}
                      />
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block' }}>{toggle.label}</span>
                        <span style={{ fontSize: '11px', color: '#6B7280' }}>{toggle.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3: Signature & Disclaimer */}
              <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                  <span className="material-symbols-outlined" style={{ color: '#4F46E5' }}>draw</span>
                  Signature & Footers
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  
                  {/* Signatory Name */}
                  <div>
                    <label htmlFor="signatory-name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Authorized Signatory Title</label>
                    <input
                      id="signatory-name"
                      type="text"
                      placeholder="e.g. HR Manager / Managing Director"
                      value={signatoryName}
                      onChange={e => setSignatoryName(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6B7280' }}>Label shown directly underneath the signature line.</p>
                  </div>

                  {/* Footer disclaimer */}
                  <div>
                    <label htmlFor="footer-text" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Footer Notes / Disclaimer</label>
                    <input
                      id="footer-text"
                      type="text"
                      placeholder="e.g. Computer generated payslip"
                      value={footerText}
                      onChange={e => setFooterText(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6B7280' }}>Disclaimers rendered in fine print at the bottom of the sheet.</p>
                  </div>

                </div>
              </div>

              {/* Save Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={fetchSettings}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    background: '#FFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 24px',
                    background: '#4F46E5',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
                  }}
                >
                  {saving ? (
                    <>
                      <div style={{
                        width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#fff', borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                      }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                      Save Settings
                    </>
                  )}
                </button>
              </div>

            </form>

            {/* Right Column: Sticky Live Preview Panel */}
            <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                  <span className="material-symbols-outlined" style={{ color: '#4F46E5' }}>preview</span>
                  Live Payslip Preview
                </h3>
                <span className="badge badge-success" style={{ fontSize: '10px', fontWeight: 'bold' }}>UPDATES INSTANTLY</span>
              </div>
              
              <div style={{
                border: '1px solid #E5E7EB',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
                background: '#FFF'
              }}>
                <PayslipTemplateRenderer
                  settings={{
                    companyName,
                    logoUrl: logoPreview || logoUrl,
                    templateSelector,
                    tableType,
                    signatoryName,
                    footerText,
                    contactEmail,
                    contactPhone,
                    companyAddress,
                    showBaseSalary,
                    showAllowances,
                    showDeductions,
                    showAttendance,
                    showLeaveStats,
                    showOvertime,
                    showTaxDetails,
                    showSignature
                  }}
                  payslipData={mockPayslipData}
                />
              </div>
            </div>

          </div>
        )}

      </div>
    </AppLayout>
  );
}
