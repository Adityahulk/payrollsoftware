import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { payrollApi } from '../api/payroll';
import { usersApi } from '../api';
import toast from 'react-hot-toast';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function ProgressBar({ value, color, height = 8 }) {
  return (
    <div style={{ background: 'var(--gray-100)', borderRadius: 999, height, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(value, 100)}%`, height: '100%',
        background: color, borderRadius: 999,
        transition: 'width 0.8s cubic-bezier(.4,0,.2,1)'
      }} />
    </div>
  );
}

function GradeBadge({ grade }) {
  const colors = {
    'A+': { bg: '#D1FAE5', text: '#059669' },
    'A': { bg: '#DBEAFE', text: '#2563EB' },
    'B': { bg: '#FEF3C7', text: '#D97706' },
    'C': { bg: '#FED7AA', text: '#EA580C' },
    'D': { bg: '#FEE2E2', text: '#DC2626' },
  };
  const c = colors[grade] || colors['D'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '4px 14px', borderRadius: 8, fontSize: 14, fontWeight: 800,
      background: c.bg, color: c.text, letterSpacing: '.02em'
    }}>
      Grade {grade}
    </span>
  );
}

function StatMiniCard({ icon, label, value, color }) {
  return (
    <div style={{
      padding: 14, background: 'var(--gray-50)', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      <span className="material-symbols-outlined" style={{
        fontSize: 22, color, background: `${color}15`, borderRadius: 8, padding: 6
      }}>{icon}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{label}</div>
      </div>
    </div>
  );
}

function PayslipCard({ slip: rawSlip, fmt }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);

  // Normalize camelCase fields from C# Backend serialize response to lowercase
  const slip = {
    ...rawSlip,
    generatedat: rawSlip.generatedAt || rawSlip.generatedat,
    paymentmethod: rawSlip.paymentMethod || rawSlip.paymentmethod,
    finalamount: rawSlip.finalAmount || rawSlip.finalamount,
    baseamount: rawSlip.baseAmount || rawSlip.baseamount,
    totalallowance: rawSlip.totalAllowance || rawSlip.totalallowance,
    totaldeduction: rawSlip.totalDeduction || rawSlip.totaldeduction,
    transactionid: rawSlip.transactionId || rawSlip.transactionid,
    bankname: rawSlip.bankName || rawSlip.bankname,
    accountnumber: rawSlip.accountNumber || rawSlip.accountnumber,
    accountholdername: rawSlip.accountHolderName || rawSlip.accountholdername,
    ifsccode: rawSlip.ifscCode || rawSlip.ifsccode,
    upiid: rawSlip.upiId || rawSlip.upiid,
    empid: rawSlip.empId || rawSlip.empid,
    spaceid: rawSlip.spaceId || rawSlip.spaceid,
  };

  let breakdown = null;
  if (slip.breakdown) {
    try { breakdown = JSON.parse(slip.breakdown); } catch { breakdown = null; }
  }

  const date = slip.generatedat
    ? new Date(slip.generatedat).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const methodIcon = {
    'Cash': 'payments',
    'UPI': 'qr_code',
    'Bank Transfer': 'account_balance',
    'Razorpay': 'credit_card',
  }[slip.paymentmethod] || 'receipt_long';

  const methodColor = {
    'Cash': '#10B981',
    'UPI': '#2563EB',
    'Bank Transfer': '#8B5CF6',
    'Razorpay': '#4F46E5',
  }[slip.paymentmethod] || '#6B7280';

  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked! Please allow pop-ups for this website.');
      return;
    }

    const gross = (slip.basic || slip.baseamount || 0) + (slip.totalallowance || 0);
    const deductions = slip.totaldeduction || 0;
    const net = slip.finalamount || 0;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${date}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
            body {
              font-family: 'Outfit', sans-serif;
              color: #1E293B;
              padding: 40px;
              margin: 0;
              background: #ffffff;
            }
            .header-table {
              width: 100%;
              border-bottom: 2px solid #E2E8F0;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .company-title {
              font-size: 24px;
              font-weight: 800;
              color: #4F46E5;
              margin: 0;
            }
            .doc-type {
              font-size: 13px;
              font-weight: 700;
              color: #64748B;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              text-align: right;
            }
            .meta-section {
              width: 100%;
              margin-bottom: 24px;
              border-collapse: collapse;
            }
            .meta-section td {
              padding: 8px 12px;
              font-size: 13px;
              border-bottom: 1px dashed #E2E8F0;
            }
            .meta-label {
              color: #64748B;
              font-weight: 500;
              width: 25%;
            }
            .meta-value {
              font-weight: 700;
              color: #0F172A;
              width: 25%;
            }
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
            }
            .details-table th {
              background: #F8FAFC;
              border-bottom: 2px solid #E2E8F0;
              padding: 10px 14px;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #64748B;
              text-align: left;
            }
            .details-table td {
              padding: 10px 14px;
              font-size: 13px;
              border-bottom: 1px solid #F1F5F9;
            }
            .net-box {
              background: linear-gradient(135deg, #8B5CF6, #4F46E5);
              color: #FFFFFF;
              border-radius: 12px;
              padding: 20px;
              margin-top: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .net-title {
              font-size: 11px;
              opacity: 0.85;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 4px;
            }
            .net-amount {
              font-size: 26px;
              font-weight: 800;
            }
            .bank-info {
              text-align: right;
              font-size: 13px;
              opacity: 0.9;
            }
            .footer-note {
              margin-top: 40px;
              text-align: center;
              font-size: 11px;
              color: #94A3B8;
              border-top: 1px solid #E2E8F0;
              padding-top: 16px;
            }
            @media print {
              body {
                padding: 10px;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <h1 class="company-title">RickWorkers Systems</h1>
                <div style="font-size: 12px; color: #64748B; margin-top: 4px;">Official Payslip Statement</div>
              </td>
              <td class="doc-type">
                CONFIDENTIAL
              </td>
            </tr>
          </table>

          <table class="meta-section">
            <tr>
              <td class="meta-label">Employee Name:</td>
              <td class="meta-value">${slip.accountholdername || user?.name || 'Employee'}</td>
              <td class="meta-label">Employee ID:</td>
              <td class="meta-value">#${slip.empid || user?.empId || '—'}</td>
            </tr>
            <tr>
              <td class="meta-label">Statement Date:</td>
              <td class="meta-value">${date}</td>
              <td class="meta-label">Space ID / Dept:</td>
              <td class="meta-value">${slip.spaceid || user?.spaceId || '—'}</td>
            </tr>
            <tr>
              <td class="meta-label">Payment Method:</td>
              <td class="meta-value" style="font-weight: 800; color: #4F46E5;">${slip.paymentmethod || '—'}</td>
              <td class="meta-label">Transaction ID:</td>
              <td class="meta-value" style="font-family: monospace; font-size: 11px;">${slip.transactionid || '—'}</td>
            </tr>
          </table>

          <table style="width: 100%; margin-bottom: 24px; border-collapse: collapse;">
            <tr style="vertical-align: top;">
              <td style="width: 50%; padding-right: 15px; border: none;">
                <table class="details-table" style="width: 100%;">
                  <thead>
                    <tr>
                      <th colspan="2">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Basic Salary</td>
                      <td style="text-align: right; font-weight: 600;">₹${Number(slip.basic || slip.baseamount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    ${breakdown && breakdown.allowances && breakdown.allowances.length > 0 ? 
                      breakdown.allowances.map(a => `
                        <tr>
                          <td style="color: #475569;">${a.name}</td>
                          <td style="text-align: right; font-weight: 600; color: #10B981;">+₹${Number(a.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      `).join('') :
                      (breakdown && (breakdown.hra || breakdown.da) ? `
                        ${breakdown.hra > 0 ? `
                          <tr>
                            <td style="color: #475569;">HRA</td>
                            <td style="text-align: right; font-weight: 600; color: #10B981;">+₹${Number(breakdown.hra).toLocaleString('en-IN')}</td>
                          </tr>
                        ` : ''}
                        ${breakdown.da > 0 ? `
                          <tr>
                            <td style="color: #475569;">Dearness Allowance</td>
                            <td style="text-align: right; font-weight: 600; color: #10B981;">+₹${Number(breakdown.da).toLocaleString('en-IN')}</td>
                          </tr>
                        ` : ''}
                      ` : '')
                    }
                    <tr style="font-weight: 700; border-top: 2px solid #E2E8F0;">
                      <td>Total Gross</td>
                      <td style="text-align: right; color: #10B981;">₹${Number(gross).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style="width: 50%; padding-left: 15px; border: none;">
                <table class="details-table" style="width: 100%;">
                  <thead>
                    <tr>
                      <th colspan="2">Deductions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${breakdown && breakdown.deductions && breakdown.deductions.length > 0 ? 
                      breakdown.deductions.map(d => `
                        <tr>
                          <td style="color: #475569;">${d.name}</td>
                          <td style="text-align: right; font-weight: 600; color: #EF4444;">-₹${Number(d.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      `).join('') : ''
                    }
                    ${breakdown && breakdown.penalties && breakdown.penalties.length > 0 ? 
                      breakdown.penalties.map(p => `
                        <tr>
                          <td style="color: #EF4444;">⚠️ Penalty: ${p.name}</td>
                          <td style="text-align: right; font-weight: 600; color: #EF4444;">-₹${Number(p.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      `).join('') : ''
                    }
                    ${(!breakdown || (!breakdown.deductions && !breakdown.penalties)) && slip.totaldeduction > 0 ? `
                      <tr>
                        <td style="color: #475569;">Standard Deductions</td>
                        <td style="text-align: right; font-weight: 600; color: #EF4444;">-₹${Number(slip.totaldeduction).toLocaleString('en-IN')}</td>
                      </tr>
                    ` : ''}
                    ${(!breakdown || (!breakdown.deductions && !breakdown.penalties)) && slip.totaldeduction === 0 && slip.deduction > 0 ? `
                      <tr>
                        <td style="color: #475569;">Deductions</td>
                        <td style="text-align: right; font-weight: 600; color: #EF4444;">-₹${Number(slip.deduction).toLocaleString('en-IN')}</td>
                      </tr>
                    ` : ''}
                    <tr style="font-weight: 700; border-top: 2px solid #E2E8F0;">
                      <td>Total Deductions</td>
                      <td style="text-align: right; color: #EF4444;">-₹${Number(deductions).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </table>

          <div class="net-box">
            <div>
              <div class="net-title">Net Take Home Pay</div>
              <div class="net-amount">₹${Number(net).toLocaleString('en-IN')}</div>
            </div>
            ${slip.bankname ? `
              <div class="bank-info">
                <div style="font-weight: 700;">${slip.bankname}</div>
                <div style="margin-top: 4px; opacity: 0.95;">A/C: XXXX${(slip.accountnumber || '').slice(-4)}</div>
                <div style="margin-top: 2px; opacity: 0.85; font-size: 11px;">IFSC: ${slip.ifsccode || '—'}</div>
              </div>
            ` : (slip.upiid ? `
              <div class="bank-info">
                <div style="font-weight: 700;">UPI Payout</div>
                <div style="margin-top: 4px; opacity: 0.95;">ID: ${slip.upiid}</div>
              </div>
            ` : '')}
          </div>

          <div class="footer-note">
            This is a computer-generated statement and does not require a physical signature.
            <div style="margin-top: 6px;">RickWorkers Systems Private Limited • Confidential Document</div>
          </div>

          <div style="margin-top: 30px; text-align: center;" class="no-print">
            <button onclick="window.print();" style="background: #4F46E5; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">
              Confirm & Print
            </button>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div style={{
      border: '1px solid var(--gray-200)',
      borderRadius: 16,
      overflow: 'hidden',
      background: '#FFF',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s'
    }}>
      {/* Payslip Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
          background: expanded ? '#F8FAFC' : '#FFF',
          borderBottom: expanded ? '1px solid var(--gray-100)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${methodColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: methodColor }}>{methodIcon}</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>
              Payslip — {date}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge badge-success" style={{ fontSize: 10 }}>Paid</span>
              {slip.paymentmethod && (
                <span style={{ color: methodColor, fontWeight: 600 }}>via {slip.paymentmethod}</span>
              )}
              {slip.transactionid && (
                <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>• Txn: {slip.transactionid}</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981' }}>{fmt(slip.finalamount)}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Net Pay</div>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            expand_more
          </span>
        </div>
      </div>

      {/* Expanded Payslip Details */}
      {expanded && (
        <div style={{ padding: '20px 24px' }}>
          {/* Summary Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Basic', value: slip.basic || slip.baseamount, color: '#4F46E5' },
              { label: 'Total Allowances', value: slip.totalallowance, color: '#10B981' },
              { label: 'Total Deductions', value: slip.totaldeduction, color: '#EF4444' },
            ].map(item => (
              <div key={item.label} style={{
                padding: 12, borderRadius: 10, textAlign: 'center',
                background: `${item.color}08`, border: `1px solid ${item.color}20`
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{fmt(item.value || 0)}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Breakdown from Admin-Configured Data */}
          {breakdown ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Earnings */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                  Earnings
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                  <span>Basic Salary</span>
                  <span style={{ fontWeight: 600, color: '#4F46E5' }}>{fmt(breakdown.basic || 0)}</span>
                </div>
                {/* Allowances from breakdown */}
                {breakdown.allowances && breakdown.allowances.length > 0 ? (
                  breakdown.allowances.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                      <span style={{ color: 'var(--gray-600)' }}>{a.name}</span>
                      <span style={{ fontWeight: 600, color: '#10B981' }}>+{fmt(a.amount || 0)}</span>
                    </div>
                  ))
                ) : breakdown.hra || breakdown.da ? (
                  <>
                    {breakdown.hra > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                        <span style={{ color: 'var(--gray-600)' }}>HRA</span>
                        <span style={{ fontWeight: 600, color: '#10B981' }}>+{fmt(breakdown.hra)}</span>
                      </div>
                    )}
                    {breakdown.da > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                        <span style={{ color: 'var(--gray-600)' }}>Dearness Allowance</span>
                        <span style={{ fontWeight: 600, color: '#F59E0B' }}>+{fmt(breakdown.da)}</span>
                      </div>
                    )}
                  </>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, fontWeight: 700, color: '#10B981' }}>
                  <span>Total Earnings</span>
                  <span>{fmt((breakdown.basic || 0) + (breakdown.allowances ? breakdown.allowances.reduce((s, a) => s + (a.amount || 0), 0) : ((breakdown.hra || 0) + (breakdown.da || 0))))}</span>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                  Deductions & Penalties
                </div>
                {breakdown.deductions && breakdown.deductions.length > 0 ? (
                  breakdown.deductions.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                      <span style={{ color: 'var(--gray-600)' }}>{d.name}</span>
                      <span style={{ fontWeight: 600, color: '#EF4444' }}>-{fmt(d.amount || 0)}</span>
                    </div>
                  ))
                ) : null}
                {breakdown.penalties && breakdown.penalties.length > 0 ? (
                  breakdown.penalties.map((p, i) => (
                    <div key={`pen-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 13 }}>
                      <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                        {p.name}
                      </span>
                      <span style={{ fontWeight: 600, color: '#EF4444' }}>-{fmt(p.amount || 0)}</span>
                    </div>
                  ))
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, fontWeight: 700, color: '#EF4444' }}>
                  <span>Total Deductions</span>
                  <span>-{fmt(slip.totaldeduction || 0)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, background: '#F0FDF4', borderRadius: 10, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: '#047857' }}>Gross Pay</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{fmt(slip.baseamount)}</div>
              </div>
              <div style={{ padding: 12, background: '#FEF2F2', borderRadius: 10, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: '#991B1B' }}>Deductions</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>-{fmt(slip.deduction)}</div>
              </div>
            </div>
          )}

          {/* Net Pay Footer */}
          <div style={{
            marginTop: 16,
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #059669, #10B981)',
            borderRadius: 12, color: '#FFF',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: .8 }}>Net Take Home</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(slip.finalamount)}</div>
            </div>
            {slip.bankname ? (
              <div style={{ textAlign: 'right', opacity: .9 }}>
                <div style={{ fontSize: 12 }}>{slip.bankname}</div>
                <div style={{ fontSize: 12 }}>A/C: XXXX{(slip.accountnumber || '').slice(-4)}</div>
              </div>
            ) : slip.upiid ? (
              <div style={{ textAlign: 'right', opacity: .9 }}>
                <div style={{ fontSize: 12 }}>UPI Direct Payout</div>
                <div style={{ fontSize: 12 }}>{slip.upiid}</div>
              </div>
            ) : null}
          </div>

          {/* Download PDF Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }} className="no-print">
            <button
              onClick={handleDownloadPdf}
              className="btn"
              style={{
                background: '#8B5CF6',
                color: '#FFF',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
              Download PDF Payslip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalaryPage({ isAdmin }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('breakdown');
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [selYear, setSelYear] = useState(new Date().getFullYear());

  // Admin-specific state
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [processing, setProcessing] = useState(false);

  // All state — driven by backend
  const [salary, setSalary] = useState(null);
  const [impact, setImpact] = useState(null);
  const [progress, setProgress] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [history, setHistory] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [ctcSummary, setCtcSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load roster for administrators
  useEffect(() => {
    if (isAdmin) {
      usersApi.getCompanyUsers()
        .then(res => {
          const list = res.data || [];
          const activeEmps = list.filter(u => (u.role || '').toLowerCase() !== 'admin');
          setEmployees(activeEmps);
          if (activeEmps.length > 0) {
            setSelectedEmpId(activeEmps[0].empId);
          } else {
            setLoading(false);
          }
        })
        .catch(err => {
          console.error("Failed to load company employees for payroll:", err);
          toast.error("Failed to load employee list.");
          setLoading(false);
        });
    }
  }, [isAdmin]);

  const fetchAllData = useCallback((month, year, targetEmpId) => {
    setLoading(true);
    const ac = new AbortController();

    if (isAdmin) {
      if (!targetEmpId) {
        setLoading(false);
        return () => ac.abort();
      }

      Promise.allSettled([
        payrollApi.getFullPayrollDetails(targetEmpId, month, year, ac.signal),
        payrollApi.getProgressByEmpId(targetEmpId, ac.signal)
      ]).then(([fullRes, progressRes]) => {
        if (fullRes.status === 'fulfilled') {
          const data = fullRes.value.data;
          setSalary(data.salaryStructure);
          setHistory(data.paymentHistory || []);
          setPayslips(data.payslips || []);
          setImpact(data.workImpact);

          // Build dynamic CTC preview from structure
          const sObj = data.salaryStructure;
          if (sObj) {
            const allowancesSum = sObj.allowances ? sObj.allowances.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) : ((sObj.hra || 0) + (sObj.da || 0));
            const hasDynamic = sObj.deductions && sObj.deductions.length > 0;
            const pfVal = hasDynamic ? (sObj.deductions.find(d => d.name.includes('PF'))?.amount || 0) : (sObj.pf || 0);
            const tdsVal = hasDynamic ? (sObj.deductions.find(d => d.name.includes('TDS'))?.amount || 0) : (sObj.tds || 0);

            setCtcSummary({
              annualBasic: sObj.basic * 12,
              annualHra: (sObj.hra || 0) * 12,
              annualDa: (sObj.da || 0) * 12,
              annualGross: sObj.gross * 12,
              annualPf: pfVal * 12,
              annualTds: tdsVal * 12,
              annualNet: sObj.net * 12
            });
          } else {
            setCtcSummary(null);
          }
        } else {
          console.warn('Full payroll details fetch failed:', fullRes.reason);
          setSalary(null);
          setHistory([]);
          setPayslips([]);
          setImpact(null);
          setCtcSummary(null);
        }

        if (progressRes.status === 'fulfilled') {
          setProgress(progressRes.value.data);
          const pData = progressRes.value.data;
          if (pData) {
            const hours = Number(pData.totalHoursWorked || 0);
            const score = Math.min(100, Math.max(30, (hours / 160) * 100));
            let grade = 'B';
            if (score >= 90) grade = 'A+';
            else if (score >= 80) grade = 'A';
            else if (score >= 60) grade = 'B';
            else if (score >= 45) grade = 'C';
            else grade = 'D';

            setPerformance({
              productivityScore: score,
              grade: grade
            });
          } else {
            setPerformance(null);
          }
        } else {
          setProgress(null);
          setPerformance(null);
        }
      }).finally(() => setLoading(false));
    } else {
      // Regular Employee View
      Promise.allSettled([
        payrollApi.getMySalary(month, year, ac.signal),
        payrollApi.getPayrollImpact(ac.signal),
        payrollApi.getMyProgress(ac.signal),
        payrollApi.getPerformance(ac.signal),
        payrollApi.getPaymentHistory(ac.signal),
        payrollApi.getCtcSummary(year, ac.signal),
        payrollApi.getMyPayslips(ac.signal),
      ]).then(([salaryRes, impactRes, progressRes, perfRes, historyRes, ctcRes, slipsRes]) => {
        if (salaryRes.status === 'fulfilled') setSalary(salaryRes.value.data);
        else console.warn('Salary fetch failed:', salaryRes.reason);

        if (impactRes.status === 'fulfilled') setImpact(impactRes.value.data);
        if (progressRes.status === 'fulfilled') setProgress(progressRes.value.data);
        if (perfRes.status === 'fulfilled') setPerformance(perfRes.value.data);
        if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data || []);
        if (ctcRes.status === 'fulfilled') setCtcSummary(ctcRes.value.data);
        if (slipsRes.status === 'fulfilled') setPayslips(slipsRes.value.data || []);
      }).finally(() => setLoading(false));
    }

    return () => ac.abort();
  }, [isAdmin]);

  useEffect(() => {
    const cleanup = fetchAllData(selMonth, selYear, isAdmin ? selectedEmpId : undefined);
    return cleanup;
  }, [selMonth, selYear, selectedEmpId, isAdmin, fetchAllData]);

  const handleProcessPayroll = async () => {
    const monthName = MONTHS[selMonth - 1];
    if (!window.confirm(`Are you sure you want to process and disburse payroll payouts for ${monthName} ${selYear} for all active employees? This will generate official payslips and cannot be undone.`)) {
      return;
    }

    setProcessing(true);
    const loadingToast = toast.loading(`Processing payroll payouts for ${monthName} ${selYear}...`);
    try {
      const res = await payrollApi.processMonthPayroll(selMonth, selYear);
      toast.success(res.data.message || `Successfully processed monthly payroll.`, { id: loadingToast });
      if (selectedEmpId) {
        fetchAllData(selMonth, selYear, selectedEmpId);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to process payroll for the month.", { id: loadingToast });
    } finally {
      setProcessing(false);
    }
  };

  const s = salary;
  const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
  const hasDynamicDeductions = s && s.deductions && s.deductions.length > 0;
  const totalPenalties = impact ? Number(impact.latePenalty || 0) : 0;
  const finalNet = s ? (hasDynamicDeductions ? Number(s.net) : Number(s.net) - totalPenalties) : 0;

  const tabs = [
    ['breakdown', 'Salary Breakdown'],
    ['slips', `My Payslips${payslips.length > 0 ? ` (${payslips.length})` : ''}`],
    ['history', 'Payment History'],
    ['yearly', 'CTC Summary'],
  ];

  return (
    <AppLayout role={isAdmin ? 'admin' : 'employee'}>
      <div className="page-content fade-in">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, background: 'linear-gradient(135deg, var(--gray-900), var(--gray-600))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {isAdmin ? "Admin Payroll Control Center" : "Payroll / CTC"}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              {isAdmin ? "Oversee, configure, and disburse payouts for all active roster members" : "Your salary details — live from database"}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', fontSize: 20 }}>group</span>
                <select
                  id="employee-select"
                  className="form-select"
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  style={{ width: 220, fontWeight: 600, borderColor: 'var(--gray-300)' }}
                  aria-label="Select employee"
                >
                  {employees.length === 0 ? (
                    <option value="">No active employees</option>
                  ) : (
                    employees.map(emp => (
                      <option key={emp.empId} value={emp.empId}>
                        {emp.name} ({emp.role})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
            
            <select
              className="form-select"
              id="salary-month-select"
              value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}
              style={{ width: 130, fontWeight: 600 }}
              aria-label="Select month"
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              className="form-select"
              id="salary-year-select"
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
              style={{ width: 90, fontWeight: 600 }}
              aria-label="Select year"
            >
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {isAdmin && (
              <button
                onClick={handleProcessPayroll}
                disabled={processing}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_settings</span>
                {processing ? "Processing..." : "Process Month Payouts"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 24 }}>
          {tabs.map(([key, label]) => (
            <button key={key} id={`tab-${key}`} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 20 }}>
            <div className="card" style={{ flex: 1, height: 350, animation: 'pulse 1.5s infinite', background: 'var(--gray-50)' }} />
            <div className="card" style={{ flex: 1, height: 350, animation: 'pulse 1.5s infinite', background: 'var(--gray-50)' }} />
          </div>
        ) : (
          <>
            {/* ===== TAB 1: SALARY BREAKDOWN ===== */}
            {tab === 'breakdown' && (
              !s ? (
                <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>account_balance_wallet</span>
                  <p style={{ fontWeight: 600 }}>No salary data available</p>
                  <p style={{ fontSize: 13 }}>
                    {isAdmin
                      ? "This employee has no salary structure configured yet. Please configure it in the Spaces panel."
                      : "Contact your admin to set up your salary structure"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-2" style={{ gap: 20 }}>
                  {/* Left: Salary Components */}
                  <div className="card">
                    <style>{`
                      @media print {
                        body { background: #fff !important; color: #000 !important; }
                        .no-print, header, nav, .tabs, .page-content > div:first-child, .grid-2 > div:last-child { display: none !important; }
                        .page-content { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
                        .grid-2 { display: block !important; }
                        .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; background: #fff !important; width: 100% !important; }
                        .print-only-header { display: block !important; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                      }
                    `}</style>

                    <div className="print-only-header" style={{ display: 'none', marginBottom: 24, borderBottom: '2px solid #E2E8F0', paddingBottom: 16 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: 0 }}>RickWorkers Systems Private Limited</h2>
                      <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>Official Salary Slip & Breakdown</p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="no-print">
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>Salary Components — {MONTHS[selMonth - 1]} {selYear}</h3>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button
                          onClick={() => window.print()}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', gap: '6px', display: 'flex', alignItems: 'center' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>print</span>
                          Print Slip
                        </button>
                        <span className="badge badge-success">Active</span>
                      </div>
                    </div>

                    {/* Earnings */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Gross Earnings</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4F46E5', display: 'inline-block' }} />
                          <span style={{ fontSize: 14 }}>Basic Salary</span>
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{fmt(s.basic)}</span>
                      </div>
                      {s.allowances && s.allowances.length > 0 ? (
                        s.allowances.map((item, idx) => (
                          <div key={item.name || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981', display: 'inline-block' }} />
                              <span style={{ fontSize: 14 }}>{item.name}</span>
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{fmt(item.amount)}</span>
                          </div>
                        ))
                      ) : (
                        [['HRA', s.hra, '#10B981'], ['Dearness Allowance', s.da, '#F59E0B']].map(([label, value, color]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                              <span style={{ fontSize: 14 }}>{label}</span>
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{fmt(value)}</span>
                          </div>
                        ))
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 15, color: 'var(--success)' }}>
                        <span>Total Earnings (Gross)</span>
                        <span>{fmt(s.gross)}</span>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Deductions</div>
                      {s.deductions && s.deductions.length > 0 ? (
                        s.deductions.map((item, idx) => (
                          <div key={item.name || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                            <span style={{ fontSize: 14 }}>{item.name}</span>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--error)' }}>-{fmt(item.amount)}</span>
                          </div>
                        ))
                      ) : (
                        [['Provident Fund (PF)', s.pf], ['Tax Deducted (TDS)', s.tds]].map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                            <span style={{ fontSize: 14 }}>{label}</span>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--error)' }}>-{fmt(value)}</span>
                          </div>
                        ))
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 15, color: 'var(--error)' }}>
                        <span>Total Deductions</span>
                        <span>-{fmt(hasDynamicDeductions ? s.deductions.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) : (Number(s.pf) + Number(s.tds)))}</span>
                      </div>
                    </div>

                    {/* Penalties */}
                    {!hasDynamicDeductions && impact && totalPenalties > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Penalties</div>
                        {impact.latePenalty > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#EF4444' }}>schedule</span>
                              <span style={{ fontSize: 14 }}>Late / Early Exit Penalty</span>
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 14, color: '#EF4444' }}>-{fmt(impact.latePenalty)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 15, color: '#EF4444' }}>
                          <span>Total Penalties</span>
                          <span>-{fmt(totalPenalties)}</span>
                        </div>
                      </div>
                    )}

                    {/* Net Pay */}
                    <div style={{
                      padding: 16,
                      background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                      borderRadius: 12, color: '#fff',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: 12, opacity: .75, marginBottom: 4 }}>
                          {(totalPenalties > 0 && !hasDynamicDeductions) || (hasDynamicDeductions && s.deductions.some(d => d.name.toLowerCase().includes('penalty')))
                            ? 'Final Take Home (After Penalties)'
                            : 'Net Pay (Take Home)'}
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.01em' }}>{fmt(finalNet)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, opacity: .7 }}>{MONTHS[selMonth - 1]} {selYear}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, opacity: .9 }}>{user?.email}</div>
                      </div>
                    </div>

                    {/* Payslip Available Notice */}
                    {payslips.length > 0 && (
                      <div
                        onClick={() => setTab('slips')}
                        style={{
                          marginTop: 12,
                          padding: '10px 14px',
                          background: '#F0FDF4',
                          border: '1px solid #A7F3D0',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: 13,
                          color: '#047857',
                          fontWeight: 600
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                        {payslips.length} admin-generated payslip{payslips.length > 1 ? 's' : ''} available — click to view
                      </div>
                    )}
                  </div>

                  {/* Right: CTC Distribution + Performance + Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* CTC Distribution */}
                    <div className="card">
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>CTC Distribution</h3>
                      {s.gross > 0 && (() => {
                        const ctcItems = [{ label: 'Basic', value: s.basic, color: '#4F46E5' }];
                        if (s.allowances && s.allowances.length > 0) {
                          const colors = ['#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
                          s.allowances.forEach((al, idx) => ctcItems.push({ label: al.name, value: al.amount, color: colors[idx % colors.length] }));
                        } else {
                          ctcItems.push({ label: 'HRA', value: s.hra, color: '#10B981' }, { label: 'DA', value: s.da, color: '#F59E0B' });
                        }
                        return ctcItems.map(c => (
                          <div key={c.label} style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                              <span style={{ color: 'var(--gray-500)' }}>{c.label}</span>
                              <span style={{ fontWeight: 600 }}>{Math.round((Number(c.value || 0) / Number(s.gross)) * 100)}%</span>
                            </div>
                            <ProgressBar value={(Number(c.value || 0) / Number(s.gross)) * 100} color={c.color} />
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Productivity & Performance */}
                    {performance && (
                      <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Performance</h3>
                          <GradeBadge grade={performance.grade} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                            <span style={{ color: 'var(--gray-500)' }}>Productivity Score</span>
                            <span style={{ fontWeight: 700 }}>{Math.round(performance.productivityScore)}%</span>
                          </div>
                          <ProgressBar value={performance.productivityScore} color="#4F46E5" height={10} />
                        </div>
                      </div>
                    )}

                    {/* Progress Report */}
                    {progress && (
                      <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Work Progress</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <StatMiniCard icon="task_alt" label="Tasks Done" value={`${progress.completedTasks}/${progress.totalTasks}`} color="#10B981" />
                          <StatMiniCard icon="pending_actions" label="Pending" value={progress.pendingTasks} color="#F59E0B" />
                          <StatMiniCard icon="schedule" label="Hours Logged" value={`${Number(progress.totalHoursWorked).toFixed(1)}h`} color="#4F46E5" />
                          <StatMiniCard icon="event_available" label="Attendance" value={`${Number(progress.attendancePercentage).toFixed(1)}%`} color="#8B5CF6" />
                        </div>
                      </div>
                    )}

                    {/* Work Impact & Deductions */}
                    {impact && (
                      <div className="card" style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 20 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="material-symbols-outlined" style={{ color: '#F59E0B' }}>warning_amber</span>
                          Work Impact & Penalties
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                          <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 12 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-700)' }}>{impact.presentDays} / {impact.totalWorkingDays}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Present / Working Days</div>
                          </div>
                          <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 12 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: impact.lateDays > 0 ? '#EF4444' : 'var(--gray-700)' }}>{impact.lateDays} day(s)</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Late / Early Exits</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed var(--gray-100)', paddingBottom: 6 }}>
                            <span style={{ color: 'var(--gray-500)' }}>Absent Penalties:</span>
                            <span style={{ fontWeight: 600, color: '#EF4444' }}>-{fmt(impact.absentDeduction || impact.absentPenalty || 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px dashed var(--gray-100)', paddingBottom: 6 }}>
                            <span style={{ color: 'var(--gray-500)' }}>Late Arrival Penalties:</span>
                            <span style={{ fontWeight: 600, color: '#EF4444' }}>-{fmt(impact.lateDeduction || impact.latePenalty || 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, paddingTop: 4 }}>
                            <span>Total Work Impact Deductions:</span>
                            <span style={{ color: '#EF4444' }}>-{fmt((impact.absentDeduction || impact.absentPenalty || 0) + (impact.lateDeduction || impact.latePenalty || 0))}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Summary */}
                    <div className="card">
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Quick Summary</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {(hasDynamicDeductions ? [
                          { label: 'Annual CTC', value: fmt(Number(s.gross) * 12), color: '#4F46E5' },
                          { label: 'Monthly Net', value: fmt(s.net), color: '#10B981' },
                          { label: 'Total Deductions', value: fmt(s.deductions.reduce((a, c) => a + Number(c.amount || 0), 0)), color: '#EF4444' },
                          { label: 'Total Allowances', value: fmt(s.allowances ? s.allowances.reduce((a, c) => a + Number(c.amount || 0), 0) : (s.hra + s.da)), color: '#F59E0B' },
                        ] : [
                          { label: 'Annual CTC', value: fmt(Number(s.gross) * 12), color: '#4F46E5' },
                          { label: 'Monthly Net', value: fmt(s.net), color: '#10B981' },
                          { label: 'PF (12%)', value: fmt(s.pf), color: '#F59E0B' },
                          { label: 'TDS (8%)', value: fmt(s.tds), color: '#EF4444' },
                        ]).map(item => (
                          <div key={item.label} style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ===== TAB 2: MY PAYSLIPS (Admin-Generated) ===== */}
            {tab === 'slips' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {payslips.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>description</span>
                    <p style={{ fontWeight: 600 }}>No payslips generated yet</p>
                    <p style={{ fontSize: 13 }}>
                      {isAdmin
                        ? "This employee has no generated payslips. Use the 'Process Month Payouts' button to process and generate payslips for all roster members."
                        : "Payslips appear here once your admin processes payroll for your space. Your admin must run the payroll and complete the payment."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                        {payslips.length} payslip{payslips.length > 1 ? 's' : ''} generated by your admin. Each slip shows the exact breakdown at time of payment.
                      </p>
                    </div>
                    {payslips.map((slip, i) => (
                      <PayslipCard key={slip.slipid || i} slip={slip} fmt={fmt} />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ===== TAB 3: PAYMENT HISTORY (REAL DATA) ===== */}
            {tab === 'history' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>receipt_long</span>
                    <p style={{ fontWeight: 600 }}>No payment records yet</p>
                    <p style={{ fontSize: 13 }}>Payment history will appear here once your admin processes payroll</p>
                  </div>
                ) : (
                  <table className="data-table" id="payment-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Gross Amount</th>
                        <th>Deductions</th>
                        <th>Final Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => {
                        const paidDate = h.paidAt
                          ? new Date(h.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : new Date(h.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        const isPaid = h.status === 'Paid' || h.status === 'Completed';
                        return (
                          <tr key={h.paymentId || i}>
                            <td style={{ fontWeight: 600, fontSize: 13 }}>{paidDate}</td>
                            <td style={{ fontSize: 13 }}>{fmt(h.totalAmount)}</td>
                            <td style={{ fontSize: 13, color: 'var(--error)' }}>-{fmt(h.deduction)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--success)', fontSize: 13 }}>{fmt(h.finalAmount)}</td>
                            <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{h.paymentMethod || '—'}</td>
                            <td>
                              <span className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`}>
                                {h.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ===== TAB 4: CTC SUMMARY (BACKEND CALCULATED) ===== */}
            {tab === 'yearly' && (
              <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Annual CTC Summary — {selYear}</h3>
                {ctcSummary ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                      {[
                        { label: 'Annual Basic', value: ctcSummary.annualBasic, color: '#4F46E5' },
                        { label: 'Annual HRA', value: ctcSummary.annualHra, color: '#10B981' },
                        { label: 'Annual DA', value: ctcSummary.annualDa, color: '#F59E0B' },
                        { label: 'Annual Gross CTC', value: ctcSummary.annualGross, color: '#8B5CF6' },
                        { label: 'Annual PF', value: ctcSummary.annualPf, color: '#EF4444' },
                        { label: 'Annual Take Home', value: ctcSummary.annualNet, color: '#059669' },
                      ].map(item => (
                        <div key={item.label} style={{
                          padding: 16, borderRadius: 12, border: `2px solid ${item.color}20`,
                          background: `${item.color}08`, textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{fmt(item.value)}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>{item.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Monthly breakdown bars */}
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--gray-500)' }}>Monthly Net Pay Distribution</h4>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
                      {MONTHS.map((m, i) => (
                        <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{
                            width: '70%', height: `${i === selMonth - 1 ? 100 : 75}%`,
                            background: i === selMonth - 1 ? '#4F46E5' : '#C7D2FE',
                            borderRadius: '4px 4px 0 0', transition: 'height .6s ease', minHeight: 4
                          }} />
                          <span style={{ fontSize: 10, color: i === selMonth - 1 ? '#4F46E5' : 'var(--gray-400)', fontWeight: i === selMonth - 1 ? 700 : 500 }}>
                            {m.slice(0, 3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 10 }}>analytics</span>
                    <p style={{ fontWeight: 600 }}>CTC summary unavailable</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
