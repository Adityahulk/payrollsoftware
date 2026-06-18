import React from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * PayslipTemplateRenderer
 * Renders a highly-professional, table-based corporate payslip
 * supporting dynamic settings, toggles, layouts, and incentives.
 *
 * @param {Object} props.settings Payslip customization settings
 * @param {Object} props.payslipData Salary details or historical slip record
 * @param {Object} props.user Optional logged-in user profile details for fallbacks
 */
export default function PayslipTemplateRenderer({ settings, payslipData, user }) {
  // -------------------------------------------------------------------------
  // 1. Data Normalization & Fallbacks
  // -------------------------------------------------------------------------
  
  // Base branding values
  const companyName = settings?.companyName || "Default Company";
  const companyAddress = settings?.companyAddress || '';
  const contactEmail = settings?.contactEmail || '';
  const contactPhone = settings?.contactPhone || '';
  const signatoryName = settings?.signatoryName || 'Authorized Signatory';
  const footerText = settings?.footerText || 'This is a computer-generated statement and does not require a physical signature.';
  const logoUrl = settings?.logoUrl || settings?.companyLogoUrl || '';

  // Toggles
  const showBaseSalary = settings?.showBaseSalary ?? true;
  const showAllowances = settings?.showAllowances ?? true;
  const showDeductions = settings?.showDeductions ?? true;
  const showAttendance = settings?.showAttendance ?? true;
  const showLeaveStats = settings?.showLeaveStats ?? true;
  const showOvertime = settings?.showOvertime ?? true;
  const showTaxDetails = settings?.showTaxDetails ?? true;
  const showSignature = settings?.showSignature ?? true;

  // Render format type
  const templateSelector = settings?.templateSelector || 'Classic';
  const tableType = settings?.tableType || 'Standard';

  // Extract date values
  const month = payslipData?.month || new Date().getMonth() + 1;
  const year = payslipData?.year || new Date().getFullYear();
  const statementPeriod = `${MONTHS[month - 1]} ${year}`;

  const generatedDate = payslipData?.generatedat || payslipData?.generatedAt || payslipData?.createdAt;
  const paymentDate = generatedDate
    ? new Date(generatedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  // Employee details
  const empName = payslipData?.employeeName || payslipData?.accountholdername || user?.name || 'Employee';
  const empId = payslipData?.empid || payslipData?.employeeId || user?.empId || '—';
  const spaceId = payslipData?.spaceid || payslipData?.spaceId || user?.spaceId || '—';
  
  // Payment methods
  const paymentMethod = payslipData?.paymentmethod || payslipData?.paymentMethod || '—';
  const transactionId = payslipData?.transactionid || payslipData?.transactionId || '—';
  const bankName = payslipData?.bankname || payslipData?.bankName || '';
  const accountNumber = payslipData?.accountnumber || payslipData?.accountNumber || '';
  const ifscCode = payslipData?.ifsccode || payslipData?.ifscCode || '';
  const upiId = payslipData?.upiid || payslipData?.upiId || '';

  // Attendance metrics
  const daysPresent = payslipData?.daysPresent ?? payslipData?.dayspresent ?? 0;
  const totalWorkingDays = payslipData?.totalWorkingDays ?? payslipData?.totalworkingdays ?? 22;
  const leaveDays = payslipData?.leaveDays ?? payslipData?.leavedays ?? 0;
  const overtimeHours = payslipData?.overtimeHours ?? payslipData?.overtimehours ?? 0;

  // Breakdown resolution
  let breakdown = null;
  if (payslipData?.breakdown) {
    try {
      breakdown = typeof payslipData.breakdown === 'string'
        ? JSON.parse(payslipData.breakdown)
        : payslipData.breakdown;
    } catch {
      breakdown = null;
    }
  }

  // Allowances & Deductions extraction
  let allowanceList = [];
  let deductionList = [];
  let basicSalary = 0;

  // Extract basic salary with fallback
  if (payslipData) {
    basicSalary = Number(payslipData.basic || payslipData.baseamount || payslipData.baseAmount || 0);
  }

  // Resolve Allowances
  if (showAllowances) {
    if (breakdown?.allowances && breakdown.allowances.length > 0) {
      allowanceList = breakdown.allowances.map(a => ({ name: a.name || a.Name, amount: Number(a.amount || a.Amount || 0) }));
    } else if (payslipData?.allowances && Array.isArray(payslipData.allowances)) {
      allowanceList = payslipData.allowances.map(a => ({ name: a.name || a.Name, amount: Number(a.amount || a.Amount || 0) }));
    } else {
      // Fallback manual resolution
      const hraVal = Number(breakdown?.hra || payslipData?.hra || 0);
      const daVal = Number(breakdown?.da || payslipData?.da || 0);
      if (hraVal > 0) allowanceList.push({ name: 'HRA', amount: hraVal });
      if (daVal > 0) allowanceList.push({ name: 'Dearness Allowance (DA)', amount: daVal });

      // Calculate legacy / mock incentive difference
      const totalAll = Number(payslipData?.totalallowance || payslipData?.totalAllowance || 0);
      const sumStandard = hraVal + daVal;
      if (totalAll > sumStandard) {
        allowanceList.push({ name: 'Incentive', amount: totalAll - sumStandard });
      }
    }
  }

  // If HRA/DA were included in baseamount (legacy), subtract them to show actual basic
  const hraAmt = allowanceList.find(a => a.name === 'HRA' || a.name?.toLowerCase().includes('house'))?.amount || 0;
  const daAmt = allowanceList.find(a => a.name?.includes('DA') || a.name?.toLowerCase().includes('dearness'))?.amount || 0;
  
  if (basicSalary > 0 && allowanceList.length > 0 && !payslipData.basic && (hraAmt > 0 || daAmt > 0)) {
    basicSalary = Math.max(0, basicSalary - (hraAmt + daAmt));
  }

  // Resolve Deductions
  if (showDeductions) {
    if (breakdown?.deductions && breakdown.deductions.length > 0) {
      deductionList = breakdown.deductions.map(d => ({ name: d.name || d.Name, amount: Number(d.amount || d.Amount || 0) }));
    } else if (payslipData?.deductions && Array.isArray(payslipData.deductions)) {
      deductionList = payslipData.deductions.map(d => ({ name: d.name || d.Name, amount: Number(d.amount || d.Amount || 0) }));
    } else {
      // Fallback standard deductions
      const pfVal = Number(breakdown?.pf || payslipData?.pf || 0);
      const tdsVal = Number(breakdown?.tds || payslipData?.tds || 0);
      if (pfVal > 0) deductionList.push({ name: 'Provident Fund (PF)', amount: pfVal });
      if (tdsVal > 0) deductionList.push({ name: 'Tax Deducted (TDS)', amount: tdsVal });
    }

    // Filter tax details if disabled
    if (!showTaxDetails) {
      deductionList = deductionList.filter(d => 
        !d.name?.toLowerCase().includes('pf') && 
        !d.name?.toLowerCase().includes('provident') && 
        !d.name?.toLowerCase().includes('tds') && 
        !d.name?.toLowerCase().includes('tax')
      );
    }

    // Resolve Penalties
    if (breakdown?.penalties && breakdown.penalties.length > 0) {
      breakdown.penalties.forEach(p => {
        deductionList.push({ name: `Penalty: ${p.name || p.Name}`, amount: Number(p.amount || p.Amount || 0), isPenalty: true });
      });
    } else if (payslipData?.penalty || payslipData?.latePenalty) {
      const penaltyAmt = Number(payslipData.penalty || payslipData.latePenalty || 0);
      if (penaltyAmt > 0) {
        deductionList.push({ name: 'Penalty: Work Impact / Late Clock-in', amount: penaltyAmt, isPenalty: true });
      }
    }
  }

  // Final Sum Calculations
  const finalBasic = showBaseSalary ? basicSalary : 0;
  const totalAllowances = allowanceList.reduce((sum, a) => sum + a.amount, 0);
  const totalDeductions = deductionList.reduce((sum, d) => sum + d.amount, 0);

  const grossPay = finalBasic + totalAllowances;
  const netPay = Math.max(0, grossPay - totalDeductions);

  // Helper formatter
  const formatCur = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  // -------------------------------------------------------------------------
  // 2. Styling Presets based on Template Selector & Table Layout config
  // -------------------------------------------------------------------------
  
  // Theme palette
  const getThemePalette = () => {
    const tmpl = (templateSelector || 'Classic').toLowerCase();
    if (tmpl === 'modern') {
      return {
        primary: '#6366F1', // Indigo
        primaryBg: '#EEF2FF',
        textDark: '#0F172A',
        textMuted: '#64748B',
        border: '#E2E8F0',
        tableHeader: '#F8FAFC'
      };
    }
    if (tmpl === 'compact') {
      return {
        primary: '#1E293B', // Slate
        primaryBg: '#F1F5F9',
        textDark: '#0F172A',
        textMuted: '#475569',
        border: '#CBD5E1',
        tableHeader: '#F8FAFC'
      };
    }
    // Default / Classic
    return {
      primary: '#4F46E5', // Indigo Blue
      primaryBg: '#F5F3FF',
      textDark: '#111827',
      textMuted: '#6B7280',
      border: '#E5E7EB',
      tableHeader: '#F9FAFB'
    };
  };

  const palette = getThemePalette();

  // Table padding config
  const getTablePadding = () => {
    if (tableType === 'Compact') return '6px 10px';
    if (tableType === 'Grid') return '10px 12px';
    return '8px 12px'; // Standard
  };

  const cellPadding = getTablePadding();
  const borderStyle = tableType === 'Minimalist' ? 'none' : `1px solid ${palette.border}`;

  return (
    <div style={{
      fontFamily: templateSelector === 'Modern' ? "'Plus Jakarta Sans', sans-serif" : "'Outfit', sans-serif",
      color: '#374151',
      lineHeight: '1.5',
      background: '#FFF',
      padding: tableType === 'Compact' ? '20px' : '40px',
      borderRadius: '8px',
      fontSize: '13px'
    }}>
      
      {/* ---------------------------------------------------------------------
          SECTION 1: Header (Branding & Logo)
          --------------------------------------------------------------------- */}
      <table style={{ width: '100%', borderBottom: `2px solid ${palette.primary}`, paddingBottom: '16px', marginBottom: '20px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                )}
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: 800, color: palette.primary, margin: 0, letterSpacing: '-0.02em' }}>
                    {companyName}
                  </h1>
                  {companyAddress && (
                    <div style={{ fontSize: '11px', color: palette.textMuted, marginTop: '2px', maxWidth: '380px' }}>
                      {companyAddress}
                    </div>
                  )}
                </div>
              </div>
            </td>
            <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, color: palette.textDark, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                CONFIDENTIAL PAYSLIP
              </h2>
              <div style={{ fontSize: '12px', fontWeight: 700, color: palette.primary, marginTop: '4px' }}>
                {statementPeriod}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ---------------------------------------------------------------------
          SECTION 2: Employee Information Grid
          --------------------------------------------------------------------- */}
      <table style={{ width: '100%', marginBottom: '20px', borderCollapse: 'collapse', border: `1px solid ${palette.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <tbody>
          <tr style={{ background: '#FFF' }}>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, borderRight: `1px solid ${palette.border}`, color: palette.textMuted, fontWeight: 500, width: '25%' }}>Employee Name:</td>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, borderRight: `1px solid ${palette.border}`, fontWeight: 700, color: palette.textDark, width: '25%' }}>{empName}</td>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, borderRight: `1px solid ${palette.border}`, color: palette.textMuted, fontWeight: 500, width: '25%' }}>Employee ID:</td>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, fontWeight: 700, color: palette.textDark, width: '25%' }}>#{empId}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, borderRight: `1px solid ${palette.border}`, color: palette.textMuted, fontWeight: 500 }}>Statement Period:</td>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, borderRight: `1px solid ${palette.border}`, fontWeight: 700, color: palette.textDark }}>{statementPeriod}</td>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, borderRight: `1px solid ${palette.border}`, color: palette.textMuted, fontWeight: 500 }}>Space ID / Department:</td>
            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, fontWeight: 700, color: palette.textDark }}>#{spaceId}</td>
          </tr>
          <tr style={{ background: '#FFF' }}>
            <td style={{ padding: '8px 12px', borderBottom: (showAttendance || showLeaveStats || showOvertime) ? `1px solid ${palette.border}` : 'none', borderRight: `1px solid ${palette.border}`, color: palette.textMuted, fontWeight: 500 }}>Payment Method:</td>
            <td style={{ padding: '8px 12px', borderBottom: (showAttendance || showLeaveStats || showOvertime) ? `1px solid ${palette.border}` : 'none', borderRight: `1px solid ${palette.border}`, fontWeight: 700, color: palette.primary }}>{paymentMethod}</td>
            <td style={{ padding: '8px 12px', borderBottom: (showAttendance || showLeaveStats || showOvertime) ? `1px solid ${palette.border}` : 'none', borderRight: `1px solid ${palette.border}`, color: palette.textMuted, fontWeight: 500 }}>Transaction ID:</td>
            <td style={{ padding: '8px 12px', borderBottom: (showAttendance || showLeaveStats || showOvertime) ? `1px solid ${palette.border}` : 'none', fontWeight: 700, color: palette.textDark, fontFamily: 'monospace', fontSize: '11px' }}>{transactionId || '—'}</td>
          </tr>
          {(showAttendance || showLeaveStats || showOvertime) && (
            <tr style={{ background: palette.primaryBg + '30' }}>
              <td style={{ padding: '8px 12px', borderRight: `1px solid ${palette.border}`, color: palette.textMuted, fontWeight: 600 }}>Work / Attendance Summary:</td>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: palette.textDark }} colSpan="3">
                {showAttendance && `Present: ${daysPresent} / ${totalWorkingDays} Days`}
                {showLeaveStats && ` | Leaves: ${leaveDays} Days`}
                {showOvertime && overtimeHours > 0 && ` | Overtime: ${overtimeHours} hrs`}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ---------------------------------------------------------------------
          SECTION 3 & 4: Earnings & Deductions Tables (Side-by-Side or Stacked)
          --------------------------------------------------------------------- */}
      {tableType === 'Minimalist' ? (
        // Minimalist borderless vertical layout
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
          {/* Earnings List */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: palette.primary, letterSpacing: '0.05em', borderBottom: `1px solid ${palette.primary}`, paddingBottom: '4px', marginBottom: '8px' }}>
              Earnings Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {showBaseSalary && (
                  <tr>
                    <td style={{ padding: '6px 0' }}>Basic Salary</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700 }}>{formatCur(finalBasic)}</td>
                  </tr>
                )}
                {allowanceList.map((allow, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {allow.name}
                      {allow.name?.toLowerCase().includes('incentive') && (
                        <span style={{ background: '#10B981', color: '#FFF', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                          PERFORMANCE INCENTIVE
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#10B981' }}>+{formatCur(allow.amount)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `1px dashed ${palette.border}`, fontWeight: 800 }}>
                  <td style={{ padding: '8px 0' }}>Gross Earnings (Total)</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#10B981' }}>{formatCur(grossPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deductions List */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#EF4444', letterSpacing: '0.05em', borderBottom: '1px solid #EF4444', paddingBottom: '4px', marginBottom: '8px' }}>
              Deductions Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {deductionList.map((ded, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 0', color: ded.isPenalty ? '#EF4444' : '#374151' }}>
                      {ded.isPenalty ? '⚠️ ' : ''}{ded.name}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#EF4444' }}>-{formatCur(ded.amount)}</td>
                  </tr>
                ))}
                {deductionList.length === 0 && (
                  <tr>
                    <td style={{ padding: '10px 0', color: palette.textMuted, fontStyle: 'italic' }}>No deductions applied.</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>—</td>
                  </tr>
                )}
                <tr style={{ borderTop: `1px dashed ${palette.border}`, fontWeight: 800 }}>
                  <td style={{ padding: '8px 0' }}>Total Deductions</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#EF4444' }}>-{formatCur(totalDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Standard Grid and Compact layouts (Side-by-side)
        <table style={{ width: '100%', marginBottom: '24px', borderCollapse: 'collapse', border: borderStyle }}>
          <thead>
            <tr style={{ background: palette.tableHeader, borderBottom: borderStyle }}>
              <th style={{ padding: cellPadding, textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', color: palette.textMuted, borderRight: borderStyle, width: '50%' }}>
                Earnings
              </th>
              <th style={{ padding: cellPadding, textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', color: palette.textMuted, width: '50%' }}>
                Deductions & Penalties
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {/* Earnings Column */}
              <td style={{ verticalAlign: 'top', borderRight: borderStyle, padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {showBaseSalary && (
                      <tr style={{ borderBottom: `1px solid ${palette.border}50` }}>
                        <td style={{ padding: cellPadding }}>Basic Salary</td>
                        <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 700 }}>{formatCur(finalBasic)}</td>
                      </tr>
                    )}
                    {allowanceList.map((allow, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${palette.border}50` }}>
                        <td style={{ padding: cellPadding, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 500 }}>{allow.name}</span>
                          {allow.name?.toLowerCase().includes('incentive') && (
                            <div style={{ display: 'inline-flex' }}>
                              <span style={{ background: '#10B981', color: '#FFF', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                                PERFORMANCE INCENTIVE
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 600, color: '#10B981', verticalAlign: 'middle' }}>
                          +{formatCur(allow.amount)}
                        </td>
                      </tr>
                    ))}
                    {allowanceList.length === 0 && !showBaseSalary && (
                      <tr>
                        <td style={{ padding: '20px', textAlign: 'center', color: palette.textMuted }} colSpan="2">
                          No earnings listed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>

              {/* Deductions Column */}
              <td style={{ verticalAlign: 'top', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {deductionList.map((ded, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${palette.border}50` }}>
                        <td style={{ padding: cellPadding, color: ded.isPenalty ? '#EF4444' : '#374151' }}>
                          {ded.isPenalty ? '⚠️ ' : ''}{ded.name}
                        </td>
                        <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 600, color: '#EF4444' }}>
                          -{formatCur(ded.amount)}
                        </td>
                      </tr>
                    ))}
                    {deductionList.length === 0 && (
                      <tr>
                        <td style={{ padding: '20px', textAlign: 'center', color: palette.textMuted }} colSpan="2">
                          No deductions applied.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Subtotals footer row inside table */}
            <tr style={{ background: palette.tableHeader, fontWeight: 700, borderTop: borderStyle }}>
              <td style={{ padding: cellPadding, borderRight: borderStyle }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Gross Earnings:</span>
                  <span style={{ color: '#10B981' }}>{formatCur(grossPay)}</span>
                </div>
              </td>
              <td style={{ padding: cellPadding }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Total Deductions:</span>
                  <span style={{ color: '#EF4444' }}>-{formatCur(totalDeductions)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ---------------------------------------------------------------------
          SECTION 5: Gross & Net Pay Calculation Panel
          --------------------------------------------------------------------- */}
      <div style={{
        background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.primary}CC 100%)`,
        color: '#FFF',
        padding: '18px 24px',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)'
      }}>
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85, fontWeight: 700 }}>
            Net Take Home Pay (Calculated)
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px' }}>
            {formatCur(netPay)}
          </div>
        </div>
        
        {/* Payment Account Breakdown */}
        <div style={{ textAlign: 'right', fontSize: '12px', opacity: 0.95, lineHeight: '1.4' }}>
          {bankName ? (
            <>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>{bankName}</div>
              <div style={{ marginTop: '2px' }}>Account: XXXX{accountNumber.slice(-4)}</div>
              {ifscCode && <div style={{ fontSize: '11px', opacity: 0.8 }}>IFSC: {ifscCode}</div>}
            </>
          ) : upiId ? (
            <>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>UPI Transfer</div>
              <div style={{ marginTop: '2px' }}>VPA: {upiId}</div>
            </>
          ) : (
            <div style={{ fontStyle: 'italic', fontWeight: 600 }}>Disbursed in Cash / Manual Payout</div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          SECTION 6: Footer Disclaimer, Info, & Signature Block
          --------------------------------------------------------------------- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '30px', paddingTop: '16px', borderTop: `1px solid ${palette.border}` }}>
        <div style={{ fontSize: '10px', color: palette.textMuted, maxWidth: '65%', lineHeight: '1.4' }}>
          <strong style={{ color: palette.textDark, display: 'block', marginBottom: '2px' }}>Disclaimers & Notes:</strong>
          {footerText}
          <div style={{ marginTop: '4px', fontWeight: 600 }}>
            {contactEmail && `Email: ${contactEmail}`} {contactPhone && `| Tel: ${contactPhone}`}
          </div>
        </div>
        {showSignature && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', borderTop: `1.5px solid ${palette.textDark}`, width: '160px', marginTop: '20px', paddingTop: '6px', textAlign: 'center' }}>
              <strong style={{ fontSize: '11px', color: palette.textDark, display: 'block' }}>{signatoryName}</strong>
              <span style={{ fontSize: '9px', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {companyName}
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
