import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { payrollApi } from '../api/payroll';
import { usersApi } from '../api';
import { getPayslipSettings } from '../api/settings';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';
import PayslipCard from '../components/PayslipCard';
import PayslipTemplateRenderer from '../components/PayslipTemplateRenderer';

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

// PayslipCard extracted to src/components/PayslipCard.js

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
  const [payslipSettings, setPayslipSettings] = useState(null);

  // Fetch payslip settings once for all payslip cards
  useEffect(() => {
    getPayslipSettings()
      .then(data => {
        const cleanBaseUrl = API_BASE_URL.endsWith('/api')
          ? API_BASE_URL.slice(0, -4)
          : API_BASE_URL;
        setPayslipSettings({
          ...data,
          logoUrl: data.logoUrl ? `${cleanBaseUrl}${data.logoUrl}` : '',
          companyLogoUrl: data.logoUrl ? `${cleanBaseUrl}${data.logoUrl}` : ''
        });
      })
      .catch(() => { }); // Non-critical — cards have fallback values
  }, []);

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

  const handleDownloadPdf = () => {
    const download = () => {
      const element = document.getElementById('salary-breakdown-renderer');
      const companyName = payslipSettings?.companyName || "Default Company";
      const monthName = MONTHS[selMonth - 1];
      const opt = {
        margin: 10,
        filename: `SalaryBreakdown_${companyName.replace(/\s+/g, '_')}_${monthName}_${selYear}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      window.html2pdf()
        .from(element)
        .set(opt)
        .save()
        .catch(err => {
          console.error(err);
          toast.error('Failed to generate PDF.');
        });
    };

    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => download();
      document.body.appendChild(script);
    } else {
      download();
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
                  {/* Left: Salary Components */}
                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Salary Components — {MONTHS[selMonth - 1]} {selYear}</h3>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button
                          onClick={handleDownloadPdf}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', gap: '6px', display: 'flex', alignItems: 'center' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                          Download PDF
                        </button>
                        <span className="badge badge-success">Active Structure</span>
                      </div>
                    </div>

                    <div id="salary-breakdown-renderer" style={{ border: '1px solid var(--gray-100)', borderRadius: '12px', overflow: 'hidden' }}>
                      <PayslipTemplateRenderer
                        settings={payslipSettings}
                        payslipData={{
                          ...s,
                          month: selMonth,
                          year: selYear,
                          daysPresent: progress?.attendancePercentage ? Math.round((progress.attendancePercentage * 22) / 100) : 22,
                          totalWorkingDays: 22,
                          leaveDays: progress?.attendancePercentage ? Math.round(((100 - progress.attendancePercentage) * 22) / 100) : 0,
                          overtimeHours: impact?.overtimeHours || 0,
                          employeeName: isAdmin ? employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.name : user?.name,
                          employeeId: isAdmin ? selectedEmpId : user?.empId,
                          spaceId: isAdmin ? (employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.spaceId || employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.spaceid) : user?.spaceId,
                          accountholdername: isAdmin ? (employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.accountHolderName || employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.accountholdername) : undefined,
                          accountnumber: isAdmin ? (employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.accountNumber || employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.accountnumber) : undefined,
                          bankname: isAdmin ? (employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.bankName || employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.bankname) : undefined,
                          ifsccode: isAdmin ? (employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.ifscCode || employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.ifsccode) : undefined,
                          upiid: isAdmin ? (employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.upiId || employees.find(e => e.empId === selectedEmpId || e.empid === selectedEmpId)?.upiid) : undefined,
                        }}
                        user={user}
                      />
                    </div>

                    {/* Payslip Available Notice */}
                    {payslips.length > 0 && (
                      <div
                        onClick={() => setTab('slips')}
                        style={{
                          marginTop: 16,
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
                      <PayslipCard key={slip.slipid || i} slip={slip} fmt={fmt} settings={payslipSettings} />
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
