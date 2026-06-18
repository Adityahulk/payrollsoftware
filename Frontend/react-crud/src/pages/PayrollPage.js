import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { spacesApi } from '../api/index';
import toast from 'react-hot-toast';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayrollPage() {
  const { spaceId } = useParams();
  const navigate = useNavigate();

  // State variables
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [summary, setSummary] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  // Financial & Penalty state
  const [applyPenalties, setApplyPenalties] = useState(true);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Space Rules configuration lists
  const [allowancesList, setAllowancesList] = useState([]);
  const [deductionsList, setDeductionsList] = useState([]);

  // Form input states for Rules Modal
  const [newAllowance, setNewAllowance] = useState({ name: '', type: 'Fixed', value: '' });
  const [newDeduction, setNewDeduction] = useState({ name: '', type: 'Fixed', value: '', deductiontype: 'Standard' });
  const [submittingRule, setSubmittingRule] = useState(false);

  // Drawer details & override inputs
  const [customBasic, setCustomBasic] = useState('');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);

  // Checkout & Pay Modal States
  const [checkoutCohort, setCheckoutCohort] = useState([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('Cash'); // Cash / UPI / Razorpay
  const [transactionId, setTransactionId] = useState('');
  const [checkoutOverrideAmount, setCheckoutOverrideAmount] = useState(null);
  const [checkoutBasicOverride, setCheckoutBasicOverride] = useState(null);
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [razorpaySimulating, setRazorpaySimulating] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadPayrollData();
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, applyPenalties, selMonth, selYear]);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      const res = await spacesApi.getSpacePayroll(spaceId, applyPenalties, selMonth, selYear);
      console.log("Payroll Data:", res.data);
      setSummary(res.data?.summary || res.data?.Summary || null);
      setEvaluations(res.data?.evaluations || res.data?.Evaluations || []);
    } catch (err) {
      console.error("API ERROR:", err.response?.data);
      console.warn('Failed to load performance payroll analytics silently', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      const allRes = await spacesApi.getAllowances(spaceId);
      const dedRes = await spacesApi.getDeductions(spaceId);
      setAllowancesList(allRes.data || []);
      setDeductionsList(dedRes.data || []);
    } catch (err) {
      console.error('Failed to load financial rules.', err);
    }
  };

  // Reset payroll — wipes t_payrollpayments & t_payslips for this space
  // Admin uses this to reprocess payroll for a fresh month cycle
  const handleResetPayroll = async () => {
    if (!window.confirm('⚠️ This will DELETE all payment records and payslips for this space. Employees will return to UNPAID status. Continue only for a new payroll cycle.')) return;
    setResetting(true);
    try {
      await spacesApi.resetSpacePayroll(spaceId);
      toast.success('Payroll reset successfully. All employees are now UNPAID for the new cycle.');
      loadPayrollData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset payroll.');
    } finally {
      setResetting(false);
    }
  };

  const triggerCheckout = (cohort, overrideAmt = null, basicOverride = null) => {
    if (!cohort || cohort.length === 0) {
      toast.error('No unpaid employees in this group.');
      return;
    }
    setCheckoutCohort(cohort);
    setCheckoutOverrideAmount(overrideAmt);
    setCheckoutBasicOverride(basicOverride);
    setSelectedMethod('Cash');
    setTransactionId('');
    setShowCheckoutModal(true);
  };

  const executeCheckoutSubmit = async () => {
    if (checkoutCohort.length === 0) {
      toast.error('No employees to pay.');
      return;
    }

    // 1. Validate payment method requirements
    if (selectedMethod === 'UPI') {
      if (checkoutCohort.length > 1) {
        toast.error('Direct UPI payment is NOT allowed for multiple employees (bulk payout).');
        return;
      }
      const emp = checkoutCohort[0];
      const upiid = emp.upiId || emp.upiid || emp.UpiId;
      if (!upiid || !upiid.trim()) {
        toast.error(`Employee '${emp.name || emp.Name}' does not have a UPI ID configured. Go to Profile to configure it.`);
        return;
      }
      if (!transactionId || !transactionId.trim()) {
        toast.error('Please enter the manual UPI transaction ID.');
        return;
      }
    } else if (selectedMethod === 'Bank Transfer') {
      const missingBank = checkoutCohort.filter(emp => {
        const acc = emp.accountNumber || emp.accountnumber || emp.AccountNumber;
        const bank = emp.bankName || emp.bankname || emp.BankName;
        const holder = emp.accountHolderName || emp.accountholdername || emp.AccountHolderName;
        const ifsc = emp.ifscCode || emp.ifsccode || emp.IfscCode;
        return !acc || !acc.trim() || !bank || !bank.trim() || !holder || !holder.trim() || !ifsc || !ifsc.trim();
      });

      if (missingBank.length > 0) {
        toast.error(
          `Bank Transfer payment blocked! The following employee(s) are missing complete bank account configurations (Account Number, Bank Name, Holder Name, and IFSC Code):\n${missingBank.map(e => e.name || e.Name).join(', ')}`
        );
        return;
      }
      if (!transactionId || !transactionId.trim()) {
        toast.error('Please enter the bank transaction reference ID.');
        return;
      }
    } else if (selectedMethod === 'Razorpay') {
      const missingBank = checkoutCohort.filter(emp => {
        const acc = emp.accountNumber || emp.accountnumber || emp.AccountNumber;
        const bank = emp.bankName || emp.bankname || emp.BankName;
        const holder = emp.accountHolderName || emp.accountholdername || emp.AccountHolderName;
        const ifsc = emp.ifscCode || emp.ifsccode || emp.IfscCode;
        return !acc || !acc.trim() || !bank || !bank.trim() || !holder || !holder.trim() || !ifsc || !ifsc.trim();
      });

      if (missingBank.length > 0) {
        toast.error(
          `Razorpay payment blocked! The following employee(s) are missing complete bank account configurations (Account Number, Bank Name, Holder Name, and IFSC Code):\n${missingBank.map(e => e.name || e.Name).join(', ')}`
        );
        return;
      }
    }

    // 2. Perform payments payload prep
    const buildEmployeesPayload = () => {
      return checkoutCohort.map(emp => {
        const isManual = checkoutOverrideAmount !== null && checkoutOverrideAmount !== '';
        const finalAmountToPay = isManual ? parseFloat(checkoutOverrideAmount) : (emp.finalAmount || emp.FinalAmount || 0);
        const basicVal = checkoutBasicOverride || emp.basic || emp.Basic || 0;

        const breakdownObj = {
          basic: basicVal,
          allowances: emp.allowances || emp.Allowances || [],
          deductions: emp.deductions || emp.Deductions || [],
          performancePenalties: emp.performancePenalties || emp.PerformancePenalties || 0,
          applyPenalties: applyPenalties,
          isManual: isManual
        };

        return {
          empId: emp.empId || emp.EmpId,
          totalAmount: basicVal,
          deduction: emp.totalDeductions || emp.TotalDeductions || 0,
          finalAmount: finalAmountToPay,
          isManual: isManual,
          allowanceAmount: emp.totalAllowances || emp.TotalAllowances || 0,
          deductionAmount: emp.totalDeductions || emp.TotalDeductions || 0,
          basic: basicVal,
          totalAllowance: emp.totalAllowances || emp.TotalAllowances || 0,
          totalDeduction: emp.totalDeductions || emp.TotalDeductions || 0,
          breakdown: JSON.stringify(breakdownObj)
        };
      });
    };

    // 3. Routing
    if (selectedMethod === 'Cash') {
      setPaying(true);
      try {
        const payload = {
          employees: buildEmployeesPayload(),
          paymentMethod: 'Cash',
          transactionId: null,
          month: selMonth,
          year: selYear
        };
        await spacesApi.paySpacePayroll(spaceId, payload);
        toast.success(`Cash payroll processed successfully for ${checkoutCohort.length} employee(s)!`);
      } catch (err) {
        console.error('[Cash Payment Error]', err.response?.data || err.message || err);
        toast.error(err.response?.data?.message || 'Failed to complete Cash payout.');
      } finally {
        setPaying(false);
        setShowCheckoutModal(false);
        setSelectedEmployee(null);
        loadPayrollData();
      }
    } else if (selectedMethod === 'UPI') {
      setPaying(true);
      try {
        const payload = {
          employees: buildEmployeesPayload(),
          paymentMethod: 'UPI',
          transactionId: transactionId.trim(),
          month: selMonth,
          year: selYear
        };
        await spacesApi.paySpacePayroll(spaceId, payload);
        toast.success(`UPI payroll registered successfully for ${checkoutCohort[0].name || checkoutCohort[0].Name}!`);
      } catch (err) {
        console.error('[UPI Payment Error]', err.response?.data || err.message || err);
        toast.error(err.response?.data?.message || 'Failed to complete UPI payout.');
      } finally {
        setPaying(false);
        setShowCheckoutModal(false);
        setSelectedEmployee(null);
        loadPayrollData();
      }
    } else if (selectedMethod === 'Bank Transfer') {
      setPaying(true);
      try {
        const payload = {
          employees: buildEmployeesPayload(),
          paymentMethod: 'Bank Transfer',
          transactionId: transactionId.trim(),
          month: selMonth,
          year: selYear
        };
        await spacesApi.paySpacePayroll(spaceId, payload);
        toast.success(`Bank Transfer payroll processed successfully for ${checkoutCohort.length} employee(s)!`);
      } catch (err) {
        console.error('[Bank Transfer Payment Error]', err.response?.data || err.message || err);
        toast.error(err.response?.data?.message || 'Failed to complete Bank Transfer payout.');
      } finally {
        setPaying(false);
        setShowCheckoutModal(false);
        setSelectedEmployee(null);
        loadPayrollData();
      }
    } else if (selectedMethod === 'Razorpay') {
      const totalAmount = checkoutCohort.reduce((sum, emp) => {
        const isManual = checkoutOverrideAmount !== null && checkoutOverrideAmount !== '';
        return sum + (isManual ? parseFloat(checkoutOverrideAmount) : (emp.finalAmount || emp.FinalAmount || 0));
      }, 0);

      setRazorpayLoading(true);
      let orderRes;
      try {
        orderRes = await spacesApi.createRazorpayOrder(spaceId, { amount: totalAmount });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to create Razorpay Order.');
        setRazorpayLoading(false);
        return;
      }

      const orderData = orderRes.data;
      if (orderData.isMock) {
        setRazorpaySimulating(true);
        setTimeout(async () => {
          try {
            const payload = {
              orderId: orderData.orderId,
              paymentId: orderData.orderId,
              signature: "mock_signature",
              employees: buildEmployeesPayload(),
              month: selMonth,
              year: selYear
            };
            await spacesApi.confirmRazorpayPayment(spaceId, payload);
            toast.success(`🎉 Razorpay payment processed successfully (Simulated Order: ${orderData.orderId})!`);
            setShowCheckoutModal(false);
            setSelectedEmployee(null);
            loadPayrollData();
          } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to complete mock Razorpay payout.');
          } finally {
            setRazorpaySimulating(false);
            setRazorpayLoading(false);
          }
        }, 2000);
      } else {
        const loadScript = (src) => {
          return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const resScript = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
        if (!resScript) {
          toast.error('Failed to load Razorpay SDK. Please check your internet connection.');
          setRazorpayLoading(false);
          return;
        }

        const options = {
          key: orderData.key,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "RickWorkers Space Payroll",
          description: `Payroll settlement for ${checkoutCohort.length} employee(s)`,
          order_id: orderData.orderId,
          handler: async function (response) {
            setPaying(true);
            try {
              const payload = {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                employees: buildEmployeesPayload(),
                month: selMonth,
                year: selYear
              };
              await spacesApi.confirmRazorpayPayment(spaceId, payload);
              toast.success(`🎉 Razorpay checkout completed and recorded successfully!`);
              setShowCheckoutModal(false);
              setSelectedEmployee(null);
              loadPayrollData();
            } catch (err) {
              toast.error(err.response?.data?.message || `Failed to record Razorpay payout (Order: ${orderData.orderId}).`);
            } finally {
              setPaying(false);
            }
          },
          prefill: {
            name: checkoutCohort.length === 1 ? checkoutCohort[0].name || checkoutCohort[0].Name : "Space Admin"
          },
          theme: {
            color: "#4F46E5"
          }
        };

        setRazorpayLoading(false);
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    }
  };

  // Salary configuration update
  const handleUpdateBasicSalary = async () => {
    if (!selectedEmployee || !customBasic || parseFloat(customBasic) < 0) {
      toast.error('Please enter a valid basic salary.');
      return;
    }
    setSavingBasic(true);
    try {
      const payload = {
        empId: selectedEmployee.empId || selectedEmployee.EmpId,
        spaceId: parseInt(spaceId),
        basic: parseFloat(customBasic)
      };
      await spacesApi.setEmployeeSalary(payload);
      toast.success('Basic salary updated successfully!');

      // Refresh local copy of selected employee to reflect live basic
      const updatedEmpId = selectedEmployee.empId || selectedEmployee.EmpId;
      await loadPayrollData();

      // Wait a brief moment to find updated values from state
      setTimeout(() => {
        setEvaluations(prev => {
          const matched = prev.find(e => (e.empId || e.EmpId) === updatedEmpId);
          if (matched) setSelectedEmployee(matched);
          return prev;
        });
      }, 200);

    } catch (err) {
      toast.error('Failed to update basic salary.');
    } finally {
      setSavingBasic(false);
    }
  };

  // Allowance actions
  const handleAddAllowance = async (e) => {
    e.preventDefault();
    if (!newAllowance.name || !newAllowance.value) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSubmittingRule(true);
    try {
      const payload = {
        name: newAllowance.name,
        type: newAllowance.type,
        value: parseFloat(newAllowance.value)
      };
      await spacesApi.createAllowance(spaceId, payload);
      toast.success('Allowance rule created successfully.');
      setNewAllowance({ name: '', type: 'Fixed', value: '' });
      loadRules();
      loadPayrollData();
    } catch (err) {
      toast.error('Failed to create allowance rule.');
    } finally {
      setSubmittingRule(false);
    }
  };

  const handleDeleteAllowance = async (id) => {
    try {
      await spacesApi.deleteAllowance(id);
      toast.success('Allowance rule deleted.');
      loadRules();
      loadPayrollData();
    } catch (err) {
      toast.error('Failed to delete allowance.');
    }
  };

  // Deduction actions
  const handleAddDeduction = async (e) => {
    e.preventDefault();
    if (!newDeduction.name || !newDeduction.value) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSubmittingRule(true);
    try {
      const payload = {
        name: newDeduction.name,
        type: newDeduction.type,
        value: parseFloat(newDeduction.value),
        deductionType: newDeduction.deductiontype || 'Standard'
      };
      await spacesApi.createDeduction(spaceId, payload);
      toast.success('Deduction rule created.');
      setNewDeduction({ name: '', type: 'Fixed', value: '', deductiontype: 'Standard' });
      loadRules();
      loadPayrollData();
    } catch (err) {
      toast.error('Failed to create deduction rule.');
    } finally {
      setSubmittingRule(false);
    }
  };

  const handleDeleteDeduction = async (id) => {
    try {
      await spacesApi.deleteDeduction(id);
      toast.success('Deduction rule deleted.');
      loadRules();
      loadPayrollData();
    } catch (err) {
      toast.error('Failed to delete deduction.');
    }
  };

  const toggleExpandEmployee = (empId) => {
    if (expandedEmployee === empId) {
      setExpandedEmployee(null);
    } else {
      setExpandedEmployee(empId);
    }
  };

  const handleOpenDrawer = (emp) => {
    setSelectedEmployee(emp);
    setCustomBasic(emp.basic || emp.Basic || '');
    setOverrideAmount('');
  };

  // Centralized payment status helper — handles both casing variants from API
  const isPaid = (emp) => (emp.paymentStatus === 'Paid' || emp.PaymentStatus === 'Paid');

  const completeProfiles = evaluations.filter(e => (e.profileStatus === 'Complete' || e.ProfileStatus === 'Complete'));
  const incompleteProfiles = evaluations.filter(e => (e.profileStatus !== 'Complete' && e.ProfileStatus !== 'Complete'));

  const unpaidComplete = completeProfiles.filter(e => !isPaid(e));
  const unpaidIncomplete = incompleteProfiles.filter(e => !isPaid(e));

  // Calculates space-level aggregates
  const totalPayout = evaluations.reduce((sum, e) => sum + (e.finalAmount || e.FinalAmount || 0), 0);
  const totalDeductions = evaluations.reduce((sum, e) => sum + (e.totalDeductions || e.TotalDeductions || 0), 0);

  return (
    <AppLayout role="admin">
      <div className="page-content fade-in" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60, position: 'relative' }}>

        {/* HEADER BAR */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="icon-btn" onClick={() => navigate('/admin/spaces')} style={{ background: 'var(--gray-50)', padding: 10, borderRadius: 10 }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>
                  Space Performance Payroll
                </h1>
                <span className="badge badge-primary" style={{ background: '#EDE9FE', color: '#6D28D9', fontSize: 11, fontWeight: 700, padding: '4px 8px' }}>
                  Real-time Analytics
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
                Review penalties, attendance, and tasks. Issue payslips in Rupees (₹) dynamically.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* TOGGLE FOR PERFORMANCE PENALTIES */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#FFF',
              border: '1px solid var(--gray-200)',
              padding: '6px 16px',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>Performance Penalties</span>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                <input
                  type="checkbox"
                  checked={applyPenalties}
                  onChange={(e) => setApplyPenalties(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: applyPenalties ? '#EF4444' : '#E5E7EB',
                  transition: '0.3s',
                  borderRadius: 34
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: 18, width: 18,
                    left: applyPenalties ? 22 : 3,
                    bottom: 3,
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>

            <button
              className="btn"
              onClick={() => setShowSettingsModal(true)}
              style={{
                gap: 8,
                background: '#EEF2F6',
                color: 'var(--gray-700)',
                border: '1px solid var(--gray-200)',
                fontWeight: 600
              }}
            >
              <span className="material-symbols-outlined">settings_suggest</span>
              Space Financial Rules
            </button>

            <select
              className="form-select"
              id="payroll-month-select"
              value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}
              style={{ width: 130, fontWeight: 600, padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: '#FFF' }}
              aria-label="Select month"
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              className="form-select"
              id="payroll-year-select"
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
              style={{ width: 90, fontWeight: 600, padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--gray-300)', background: '#FFF' }}
              aria-label="Select year"
            >
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <button className="btn btn-secondary" onClick={loadPayrollData} disabled={loading} style={{ gap: 8 }}>
              <span className="material-symbols-outlined">sync</span>
              Refresh calculations
            </button>

            {/* Reset Payroll - only visible when some employees are marked Paid */}
            {evaluations.some(e => isPaid(e)) && (
              <button
                className="btn"
                onClick={handleResetPayroll}
                disabled={resetting}
                title="Reset all payment records for this space. Use at the start of a new payroll cycle."
                style={{
                  gap: 8,
                  background: '#FEF2F2',
                  color: '#B91C1C',
                  border: '1px solid #FECACA',
                  fontWeight: 600
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span>
                {resetting ? 'Resetting...' : 'Reset Cycle'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--gray-400)' }}>
            <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>Calculating penalties & deductions...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* SPACE SUMMARY PANEL */}
            {summary && (
              <div className="card" style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                color: '#FFF',
                padding: 24,
                borderRadius: 16,
                border: 'none',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WORKSPACE STRUCTURE</span>
                    <h2 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0 0' }}>{summary.spaceName || summary.SpaceName}</h2>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workforce Size</span>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.workforceCount || summary.WorkforceCount} Employees</div>
                  </div>
                </div>

                <div className="grid grid-4" style={{ gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Total Hours Logged</div>
                    <strong style={{ fontSize: 20 }}>{summary.totalHoursWorked || summary.TotalHoursWorked} Hours</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Staff Present / Absent</div>
                    <strong style={{ fontSize: 20, color: '#34D399' }}>{summary.totalPresent || summary.TotalPresent}</strong>
                    <span style={{ color: '#94A3B8', margin: '0 4px' }}>/</span>
                    <strong style={{ fontSize: 20, color: '#F87171' }}>{summary.totalAbsent || summary.TotalAbsent}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Tasks Completed / Pending</div>
                    <strong style={{ fontSize: 20, color: '#6EE7B7' }}>{summary.completedTasks || summary.CompletedTasks}</strong>
                    <span style={{ color: '#94A3B8', margin: '0 4px' }}>/</span>
                    <strong style={{ fontSize: 20, color: '#FCA5A5' }}>{summary.pendingTasks || summary.PendingTasks}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Net Space Payout</div>
                    <strong style={{ fontSize: 20, color: '#34D399' }}>₹{totalPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* PERFORMANCE CONSOLIDATED FOOTER CARD */}
            <div className="card" style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderLeft: '6px solid #6366F1', background: '#F8FAFC' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase' }}>CONSOLIDATED SETTLEMENT SUMMARY</span>
                <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Final Payout: </span>
                    <strong style={{ fontSize: 18, color: 'var(--gray-900)' }}>₹{totalPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Total Deductions & Penalties: </span>
                    <strong style={{ fontSize: 18, color: '#EF4444' }}>-₹{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn"
                  onClick={() => triggerCheckout(unpaidComplete)}
                  disabled={paying || unpaidComplete.length === 0}
                  style={{
                    background: '#E6F4EA',
                    color: '#137333',
                    border: '1px solid #C2E7CB',
                    fontWeight: 700,
                    gap: 6
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                  Pay All Complete Profiles ({unpaidComplete.length})
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => triggerCheckout(unpaidIncomplete)}
                  disabled={paying || unpaidIncomplete.length === 0}
                  style={{ gap: 6, background: '#EF4444', borderColor: '#EF4444' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
                  Pay All Incomplete Profiles ({unpaidIncomplete.length})
                </button>
              </div>
            </div>

            {/* COHORTS SECTION */}
            <div className="grid grid-2" style={{ gap: 28, alignItems: 'start' }}>

              {/* COMPLETE COHORT (GREEN OUTLINE) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#065F46' }}>
                    <span className="material-symbols-outlined" style={{ color: '#10B981' }}>verified</span>
                    Complete Profiles ({completeProfiles.length})
                  </h3>
                  <span style={{ fontSize: 11, background: '#E6F4EA', color: '#137333', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                    100% Clean Sheets
                  </span>
                </div>

                {completeProfiles.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: 'center', border: '1px dashed #A7F3D0', background: '#F0FDF4' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#10B981', marginBottom: 8 }}>sentiment_dissatisfied</span>
                    <h5 style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>No Perfect Records</h5>
                    <p style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>All employees in this space have absences, pending tasks, or late clock-ins.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {completeProfiles.map(emp => (
                      <div className="card" key={emp.empId || emp.EmpId} style={{
                        padding: 16,
                        border: '1px solid #A7F3D0',
                        boxShadow: '0 4px 10px rgba(16,185,129,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        cursor: 'pointer',
                        transition: '0.2s',
                        transform: 'scale(1)'
                      }}
                        onClick={() => handleOpenDrawer(emp)}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#10B981'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#A7F3D0'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: 15, color: 'var(--gray-900)' }}>{emp.name || emp.Name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Emp #{emp.empId || emp.EmpId} • {emp.role}</div>
                          </div>
                          <span className={`badge ${isPaid(emp) ? 'badge-success' : 'badge-neutral'}`}>
                            {isPaid(emp) ? 'PAID' : 'UNPAID'}
                          </span>
                        </div>

                        <div style={{ background: '#F0FDF4', padding: '8px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#047857', fontWeight: 600 }}>Calculated Net Payout:</span>
                          <strong style={{ color: '#065F46' }}>₹{(emp.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(emp);
                            }}
                            style={{ flex: 1, padding: '6px 12px', fontSize: 12, justifyContent: 'center' }}
                          >
                            Breakdown & Override
                          </button>
                          {!isPaid(emp) && (
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerCheckout([emp]);
                              }}
                              disabled={paying}
                              style={{ flex: 1, padding: '6px 12px', fontSize: 12, justifyContent: 'center', background: '#FFF', border: '1px solid #A7F3D0', color: '#047857' }}
                            >
                              Execute Checkout
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* INCOMPLETE COHORT (RED OUTLINE) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#991B1B' }}>
                    <span className="material-symbols-outlined" style={{ color: '#EF4444' }}>error</span>
                    Incomplete Profiles ({incompleteProfiles.length})
                  </h3>
                  <span style={{ fontSize: 11, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                    Penalties Applied
                  </span>
                </div>

                {incompleteProfiles.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: 'center', border: '1px dashed #FCA5A5', background: '#FEF2F2' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#10B981', marginBottom: 8 }}>sentiment_very_satisfied</span>
                    <h5 style={{ fontSize: 14, fontWeight: 700, color: '#991B1B' }}>No Penalties Record</h5>
                    <p style={{ fontSize: 12, color: '#7F1D1D', marginTop: 4 }}>Congratulations! Every single employee in this workspace has registered clean performance sheets.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {incompleteProfiles.map(emp => {
                      const isExpanded = expandedEmployee === (emp.empId || emp.EmpId);
                      return (
                        <div className="card" key={emp.empId || emp.EmpId} style={{
                          padding: 16,
                          border: '1px solid #FCA5A5',
                          boxShadow: '0 4px 10px rgba(239,68,68,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          cursor: 'pointer'
                        }}
                          onClick={() => handleOpenDrawer(emp)}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#EF4444'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#FCA5A5'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: 15, color: 'var(--gray-900)' }}>{emp.name || emp.Name}</strong>
                              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Emp #{emp.empId || emp.EmpId} • {emp.role}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span className={`badge ${isPaid(emp) ? 'badge-success' : 'badge-neutral'}`}>
                                {isPaid(emp) ? 'PAID' : 'UNPAID'}
                              </span>
                              <button
                                className="icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandEmployee(emp.empId || emp.EmpId);
                                }}
                                style={{ padding: 4, background: 'none' }}
                              >
                                <span className="material-symbols-outlined">
                                  {isExpanded ? 'expand_less' : 'expand_more'}
                                </span>
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifycontent: 'space-between', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--gray-500)' }}>Calculated Payout:</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: 6 }}>
                                ₹{(emp.netSalary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <strong style={{ color: '#EF4444' }}>
                                ₹{(emp.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          </div>

                          {/* PENALTY BREAKDOWN ACCORDION */}
                          {isExpanded && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                background: '#FFF5F5',
                                padding: 12,
                                borderRadius: 8,
                                borderLeft: '4px solid #EF4444',
                                fontSize: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6
                              }}
                            >
                              <div style={{ fontWeight: 700, color: '#991B1B', marginBottom: 2 }}>Deductions Details:</div>
                              {emp.incompleteReasons && emp.incompleteReasons.length > 0 ? (
                                emp.incompleteReasons.map((reason, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#7F1D1D' }}>
                                    <span>{reason.split(':')[0]}</span>
                                    <strong>{reason.split(':')[1] || ''}</strong>
                                  </div>
                                ))
                              ) : (
                                <div style={{ color: '#7F1D1D' }}>Breakdowns processing...</div>
                              )}
                              <div style={{ borderTop: '1px solid #FCA5A5', marginTop: 4, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#991B1B' }}>
                                <span>Performance Penalties:</span>
                                <span>-₹{(emp.totalPerformanceDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDrawer(emp);
                              }}
                              style={{ flex: 1, padding: '6px 12px', fontSize: 12, justifyContent: 'center' }}
                            >
                              Breakdown & Override
                            </button>
                            {!isPaid(emp) && (
                              <button
                                className="btn btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerCheckout([emp]);
                                }}
                                disabled={paying}
                                style={{ flex: 1, padding: '6px 12px', fontSize: 12, justifyContent: 'center', background: '#EF4444', borderColor: '#EF4444' }}
                              >
                                Execute Checkout
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: SPACE FINANCIAL RULES & CONFIGURATIONS */}
        {/* ========================================================= */}
        {showSettingsModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: 20
          }}>
            <div className="card fade-in" style={{
              width: '100%',
              maxWidth: 800,
              background: '#FFF',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-200)', paddingBottom: 16, marginBottom: 20 }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#4F46E5', fontSize: 28 }}>settings_suggest</span>
                  Space Financial Rules & Configurations
                </h3>
                <button className="icon-btn" onClick={() => setShowSettingsModal(false)} style={{ background: '#F1F5F9', border: 'none', padding: 6, borderRadius: '50%' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              <div className="grid grid-2" style={{ gap: 24 }}>

                {/* ALLOWANCES PANEL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                    Space Allowances (Additions)
                  </h4>

                  {/* Create Allowance Form */}
                  <form onSubmit={handleAddAllowance} style={{ background: '#F0FDF4', padding: 12, borderRadius: 12, border: '1px solid #A7F3D0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="Allowance Name (e.g. HRA)"
                      value={newAllowance.name}
                      onChange={e => setNewAllowance({ ...newAllowance, name: e.target.value })}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #C2E7CB', fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={newAllowance.type}
                        onChange={e => setNewAllowance({ ...newAllowance, type: e.target.value })}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #C2E7CB', fontSize: 13, flex: 1, background: '#FFF' }}
                      >
                        <option value="Fixed">Fixed Amount (₹)</option>
                        <option value="Percentage">Percentage of Basic (%)</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={newAllowance.type === 'Fixed' ? '₹ Value' : '% Value'}
                        value={newAllowance.value}
                        onChange={e => setNewAllowance({ ...newAllowance, value: e.target.value })}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #C2E7CB', fontSize: 13, width: 90 }}
                      />
                    </div>
                    <button type="submit" disabled={submittingRule} className="btn" style={{ background: '#10B981', color: '#FFF', width: '100%', justifyContent: 'center', fontSize: 12, padding: '8px' }}>
                      Add Allowance
                    </button>
                  </form>

                  {/* Allowances List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                    {allowancesList.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: '16px 0' }}>No allowance rules configured yet.</p>
                    ) : (
                      allowancesList.map(rule => (
                        <div key={rule.allowanceId || rule.allowanceid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12 }}>
                          <div>
                            <strong style={{ color: 'var(--gray-900)' }}>{rule.name}</strong>
                            <div style={{ color: 'var(--gray-500)', fontSize: 11 }}>{rule.type === 'Percentage' ? `${rule.value}% of Basic` : `Fixed: ₹${rule.value}`}</div>
                          </div>
                          <button className="icon-btn" onClick={() => handleDeleteAllowance(rule.allowanceId || rule.allowanceid)} style={{ color: '#EF4444' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* DEDUCTIONS PANEL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>remove_circle</span>
                    Space Deductions (Retentions)
                  </h4>

                  {/* Create Deduction Form */}
                  <form onSubmit={handleAddDeduction} style={{ background: '#FEF2F2', padding: 12, borderRadius: 12, border: '1px solid #FCA5A5', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>Deduction Type / Category</label>
                      <select
                        value={newDeduction.deductiontype || 'Standard'}
                        onChange={e => {
                          const val = e.target.value;
                          let name = newDeduction.name;
                          if (val !== 'Standard') {
                            name = val; // auto-fill name for penalty categories
                          }
                          setNewDeduction({ ...newDeduction, deductiontype: val, name: name });
                        }}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #FCA5A5', fontSize: 13, background: '#FFF' }}
                      >
                        <option value="Standard">Standard Deduction (Monthly PF/TDS/Tax)</option>
                        <option value="Absent">Absent Penalty (per occurrence)</option>
                        <option value="Late">Late Clock-In Penalty (per occurrence)</option>
                        <option value="Early Exit">Early Exit Penalty (per occurrence)</option>
                        <option value="Excess Break">Excess Break Penalty (per occurrence)</option>
                        <option value="Pending Tasks">Pending Tasks Penalty (per pending task)</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Deduction Name (e.g. PF)"
                      value={newDeduction.name}
                      onChange={e => setNewDeduction({ ...newDeduction, name: e.target.value })}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #FCA5A5', fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={newDeduction.type}
                        onChange={e => setNewDeduction({ ...newDeduction, type: e.target.value })}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #FCA5A5', fontSize: 13, flex: 1, background: '#FFF' }}
                      >
                        <option value="Fixed">Fixed Retainer (₹)</option>
                        <option value="Percentage">Percentage of Basic (%)</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={newDeduction.type === 'Fixed' ? '₹ Value' : '% Value'}
                        value={newDeduction.value}
                        onChange={e => setNewDeduction({ ...newDeduction, value: e.target.value })}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #FCA5A5', fontSize: 13, width: 90 }}
                      />
                    </div>
                    <button type="submit" disabled={submittingRule} className="btn" style={{ background: '#EF4444', color: '#FFF', width: '100%', justifyContent: 'center', fontSize: 12, padding: '8px' }}>
                      Add Deduction
                    </button>
                  </form>

                  {/* Deductions List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                    {deductionsList.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: '16px 0' }}>No deduction rules configured.</p>
                    ) : (
                      deductionsList.map(rule => (
                        <div key={rule.deductionId || rule.deductionid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12 }}>
                          <div>
                            <strong style={{ color: 'var(--gray-900)' }}>{rule.name}</strong>
                            <div style={{ color: 'var(--gray-500)', fontSize: 11 }}>
                              {rule.type === 'Percentage' ? `${rule.value}% of Basic` : `Fixed: ₹${rule.value}`}
                              {(rule.deductionType || rule.deductiontype) && (rule.deductionType || rule.deductiontype) !== 'Standard'
                                ? ` (${rule.deductionType || rule.deductiontype} Penalty)`
                                : ''}
                            </div>
                          </div>
                          <button className="icon-btn" onClick={() => handleDeleteDeduction(rule.deductionId || rule.deductionid)} style={{ color: '#EF4444' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: 24, paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>
                  Close Settings
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: CHECKOUT & MULTI-CHANNEL PAYOUT ROUTER */}
        {/* ========================================================= */}
        {showCheckoutModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: 20
          }}>
            <div className="card fade-in" style={{
              width: '100%',
              maxWidth: 550,
              background: '#FFF',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              position: 'relative'
            }}>

              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                @keyframes slide-progress {
                  0% { left: -100%; }
                  50% { left: 0%; }
                  100% { left: 100%; }
                }
              `}</style>

              {/* Close Button */}
              <button
                className="icon-btn"
                onClick={() => setShowCheckoutModal(false)}
                disabled={paying || razorpayLoading || razorpaySimulating}
                style={{ position: 'absolute', right: 20, top: 20, background: '#F1F5F9', border: 'none', padding: 6, borderRadius: '50%' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>

              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ color: '#4F46E5', fontSize: 28 }}>payments</span>
                Settlement Checkout Portal
              </h3>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
                Select manual or instant digital payouts in Indian Rupees (₹).
              </p>

              {/* COHORT SUMMARY */}
              <div style={{ background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 8 }}>
                  PAYMENT COHORT ({checkoutCohort.length} Employee(s))
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 120, overflowY: 'auto', paddingRight: 4, marginBottom: 12 }}>
                  {checkoutCohort.map((emp, idx) => {
                    const isManual = checkoutOverrideAmount !== null && checkoutOverrideAmount !== '';
                    const payAmt = isManual ? parseFloat(checkoutOverrideAmount) : (emp.finalAmount || emp.FinalAmount || 0);
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>{emp.name || emp.Name}</span>
                        <strong style={{ color: 'var(--gray-900)' }}>₹{payAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>Total Settlement Amount:</span>
                  <strong style={{ fontSize: 18, color: '#10B981' }}>
                    ₹{checkoutCohort.reduce((sum, emp) => {
                      const isManual = checkoutOverrideAmount !== null && checkoutOverrideAmount !== '';
                      return sum + (isManual ? parseFloat(checkoutOverrideAmount) : (emp.finalAmount || emp.FinalAmount || 0));
                    }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* ROUTING SELECTOR */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 8 }}>
                  Select Payout Routing Channel:
                </label>
                <div style={{ display: 'flex', gap: 10 }}>

                  {/* CASH BUTTON */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('Cash')}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      borderRadius: 10,
                      border: selectedMethod === 'Cash' ? '2px solid #10B981' : '1px solid var(--gray-300)',
                      background: selectedMethod === 'Cash' ? '#F0FDF4' : '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: selectedMethod === 'Cash' ? '#10B981' : 'var(--gray-500)' }}>payments</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selectedMethod === 'Cash' ? '#047857' : 'var(--gray-700)' }}>Cash</span>
                  </button>

                  {/* UPI BUTTON (Only 1 employee) */}
                  {checkoutCohort.length === 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('UPI')}
                      style={{
                        flex: 1,
                        padding: '12px 8px',
                        borderRadius: 10,
                        border: selectedMethod === 'UPI' ? '2px solid #2563EB' : '1px solid var(--gray-300)',
                        background: selectedMethod === 'UPI' ? '#EFF6FF' : '#FFF',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: selectedMethod === 'UPI' ? '#2563EB' : 'var(--gray-500)' }}>qr_code</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: selectedMethod === 'UPI' ? '#1E40AF' : 'var(--gray-700)' }}>UPI Direct</span>
                    </button>
                  )}

                  {/* RAZORPAY BUTTON */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('Razorpay')}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      borderRadius: 10,
                      border: selectedMethod === 'Razorpay' ? '2px solid #4F46E5' : '1px solid var(--gray-300)',
                      background: selectedMethod === 'Razorpay' ? '#EEF2F6' : '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: selectedMethod === 'Razorpay' ? '#4F46E5' : 'var(--gray-500)' }}>credit_card</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selectedMethod === 'Razorpay' ? '#3730A3' : 'var(--gray-700)' }}>Razorpay</span>
                  </button>

                  {/* BANK TRANSFER BUTTON */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('Bank Transfer')}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      borderRadius: 10,
                      border: selectedMethod === 'Bank Transfer' ? '2px solid #8B5CF6' : '1px solid var(--gray-300)',
                      background: selectedMethod === 'Bank Transfer' ? '#F5F3FF' : '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: selectedMethod === 'Bank Transfer' ? '#8B5CF6' : 'var(--gray-500)' }}>account_balance</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selectedMethod === 'Bank Transfer' ? '#6D28D9' : 'var(--gray-700)' }}>Bank Transfer</span>
                  </button>

                </div>
              </div>

              {/* ROUTING SPECIFIC DETAILS */}
              {selectedMethod === 'Cash' && (
                <div style={{ background: '#F9FAFB', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--gray-600)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#10B981' }}>info</span>
                  <span><strong>Cash Settlement:</strong> Payslip will be generated instantly and marked as Paid. This does not connect to external gateways.</span>
                </div>
              )}

              {selectedMethod === 'UPI' && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 12, fontSize: 12, color: '#1E40AF', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance_wallet</span>
                      <span><strong>UPI Destination Coordinate:</strong></span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, paddingLeft: 24 }}>
                      {checkoutCohort[0].upiId || checkoutCohort[0].upiid || <span style={{ color: '#EF4444' }}>Missing UPI ID</span>}
                    </div>
                    {!(checkoutCohort[0].upiId || checkoutCohort[0].upiid) && (
                      <button
                        onClick={() => {
                          setShowCheckoutModal(false);
                          setSelectedEmployee(null);
                          navigate(`/admin/profile/${checkoutCohort[0].empId || checkoutCohort[0].EmpId}`);
                        }}
                        className="btn"
                        style={{ background: '#FFF', color: '#EF4444', border: '1px solid #EF4444', fontSize: 11, padding: '4px 8px', marginTop: 4, width: 'fit-content' }}
                      >
                        Configure UPI ID on profile
                      </button>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
                      UPI Transaction / Ref Number:
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Bank UPI Ref ID (e.g. 301294818290)"
                      value={transactionId}
                      onChange={e => setTransactionId(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--gray-300)', fontSize: 13 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4, display: 'block' }}>
                      Please process the payment on your banking app and paste the transaction reference ID above to finalize settlement.
                    </span>
                  </div>
                </div>
              )}

              {selectedMethod === 'Bank Transfer' && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: 10, padding: 12, fontSize: 12, color: '#5B21B6', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8B5CF6' }}>account_balance</span>
                      <span>Verified Digital Payout Routing Details:</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto', paddingRight: 4 }}>
                      {checkoutCohort.map((emp, index) => {
                        const acc = emp.accountNumber || emp.accountnumber || emp.AccountNumber;
                        const bank = emp.bankName || emp.bankname || emp.BankName;
                        const ifsc = emp.ifscCode || emp.ifsccode || emp.IfscCode;
                        const holder = emp.accountHolderName || emp.accountholdername || emp.AccountHolderName;
                        const hasDetails = acc && bank && ifsc && holder;
                        return (
                          <div key={index} style={{ borderBottom: index < checkoutCohort.length - 1 ? '1px solid var(--gray-200)' : 'none', paddingBottom: 6, marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                              <span>{emp.name || emp.Name}</span>
                              <span style={{ color: hasDetails ? '#10B981' : '#EF4444' }}>
                                {hasDetails ? 'Ready' : 'Incomplete Bank Info'}
                              </span>
                            </div>
                            {hasDetails ? (
                              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                                {bank} • A/C: XXXX{acc.slice(-4)} • IFSC: {ifsc} • Holder: {holder}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowCheckoutModal(false);
                                  setSelectedEmployee(null);
                                  navigate(`/admin/profile/${emp.empId || emp.EmpId}`);
                                }}
                                style={{ background: 'none', border: 'none', padding: 0, color: '#EF4444', textDecoration: 'underline', cursor: 'pointer', fontSize: 11, marginTop: 2 }}
                              >
                                Fix profile bank details
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
                      Transaction Ref ID / Reference Number:
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Bank IMPS/NEFT/RTGS Transaction Ref ID"
                      value={transactionId}
                      onChange={e => setTransactionId(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--gray-300)', fontSize: 13 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4, display: 'block' }}>
                      Please process the bank transfer via your corporate netbanking and paste the transaction reference ID above to finalize settlement.
                    </span>
                  </div>
                </div>
              )}

              {selectedMethod === 'Razorpay' && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ background: '#EEF2F6', border: '1px solid var(--gray-300)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--gray-700)', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#4F46E5' }}>account_balance</span>
                      <span>Verified Digital Payout Routing Details:</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto', paddingRight: 4 }}>
                      {checkoutCohort.map((emp, index) => {
                        const acc = emp.accountNumber || emp.accountnumber || emp.AccountNumber;
                        const bank = emp.bankName || emp.bankname || emp.BankName;
                        const ifsc = emp.ifscCode || emp.ifsccode || emp.IfscCode;
                        const hasDetails = acc && bank && ifsc;
                        return (
                          <div key={index} style={{ borderBottom: index < checkoutCohort.length - 1 ? '1px solid var(--gray-200)' : 'none', paddingBottom: 6, marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                              <span>{emp.name || emp.Name}</span>
                              <span style={{ color: hasDetails ? '#10B981' : '#EF4444' }}>
                                {hasDetails ? 'Ready' : 'Incomplete Bank Info'}
                              </span>
                            </div>
                            {hasDetails ? (
                              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                                {bank} • A/C: XXXX{acc.slice(-4)} • IFSC: {ifsc}
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowCheckoutModal(false);
                                  setSelectedEmployee(null);
                                  navigate(`/admin/profile/${emp.empId || emp.EmpId}`);
                                }}
                                style={{ background: 'none', border: 'none', padding: 0, color: '#EF4444', textDecoration: 'underline', cursor: 'pointer', fontSize: 11, marginTop: 2 }}
                              >
                                Fix profile bank details
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIONS FOOTER */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCheckoutModal(false)}
                  disabled={paying || razorpayLoading || razorpaySimulating}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={paying || razorpayLoading || razorpaySimulating || (selectedMethod === 'UPI' && !(checkoutCohort[0].upiId || checkoutCohort[0].upiid)) || (selectedMethod === 'Bank Transfer' && checkoutCohort.some(emp => { const acc = emp.accountNumber || emp.accountnumber || emp.AccountNumber; const bank = emp.bankName || emp.bankname || emp.BankName; const holder = emp.accountHolderName || emp.accountholdername || emp.AccountHolderName; const ifsc = emp.ifscCode || emp.ifsccode || emp.IfscCode; return !acc || !acc.trim() || !bank || !bank.trim() || !holder || !holder.trim() || !ifsc || !ifsc.trim(); }))}
                  onClick={executeCheckoutSubmit}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: '#4F46E5',
                    borderColor: '#4F46E5',
                    gap: 6
                  }}
                >
                  {paying || razorpayLoading || razorpaySimulating ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                      <span>Authorize Payment Run</span>
                    </>
                  )}
                </button>
              </div>

              {/* MOCK TRANSACTION PORTAL GATEWAY SIMULATION */}
              {razorpaySimulating && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(15, 23, 42, 0.95)',
                  borderRadius: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#FFF',
                  zIndex: 10000,
                  padding: 24,
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: 70, height: 70,
                    borderRadius: '50%',
                    background: 'rgba(79, 70, 229, 0.15)',
                    border: '3px dashed #4F46E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    animation: 'spin 4s linear infinite'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#818CF8' }}>lock</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: '#818CF8' }}>Razorpay Secure Sandbox</h4>
                  <p style={{ fontSize: 13, color: '#94A3B8', maxWidth: 320, lineHeight: 1.5, margin: '0 auto 12px' }}>
                    Authenticating credentials & initiating transaction protocols...
                  </p>
                  <div style={{
                    width: 140,
                    height: 4,
                    background: '#334155',
                    borderRadius: 2,
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      height: '100%',
                      width: '60%',
                      background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
                      borderRadius: 2,
                      animation: 'slide-progress 2s infinite ease-in-out'
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#64748B', marginTop: 12 }}>Secured by SSL 256-bit encryption</span>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* INTERACTIVE DRAWER: SALARY BREAKDOWN & MANUAL OVERRIDE */}
        {/* ========================================================= */}
        {selectedEmployee && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 99999
          }}
            onClick={() => setSelectedEmployee(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="fade-in-right"
              style={{
                width: '100%',
                maxWidth: 450,
                height: '100%',
                background: '#FFF',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto'
              }}
            >

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-200)', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-900)' }}>
                    Salary & Pay Breakdown
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    Emp #{selectedEmployee.empId || selectedEmployee.EmpId} • {selectedEmployee.name || selectedEmployee.Name}
                  </span>
                </div>
                <button className="icon-btn" onClick={() => setSelectedEmployee(null)} style={{ background: '#F1F5F9', border: 'none', padding: 6, borderRadius: '50%' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                </button>
              </div>

              {/* Profile status badge */}
              <div style={{
                background: selectedEmployee.profileStatus === 'Complete' ? '#E6F4EA' : '#FEE2E2',
                color: selectedEmployee.profileStatus === 'Complete' ? '#137333' : '#991B1B',
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 20
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {selectedEmployee.profileStatus === 'Complete' ? 'verified' : 'error'}
                </span>
                {selectedEmployee.profileStatus === 'Complete'
                  ? 'Complete Profile - Clean Attendance Sheet'
                  : 'Incomplete Profile - Performance Penalties Triggered'}
              </div>

              {/* Configure Bank Details Link for Admins */}
              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  navigate(`/admin/profile/${selectedEmployee.empId || selectedEmployee.EmpId}`);
                }}
                className="btn"
                style={{
                  background: '#EEF2F6',
                  color: 'var(--gray-700)',
                  border: '1px solid var(--gray-200)',
                  fontWeight: 600,
                  fontSize: 12,
                  width: '100%',
                  justifyContent: 'center',
                  gap: 6,
                  marginBottom: 20
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_balance</span>
                Configure Bank & Payment Profile
              </button>

              {/* Form 1: Modify Basic Salary */}
              <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid var(--gray-200)', marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
                  Configure Basic Salary (₹)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: 10, top: 8, fontSize: 13, color: 'var(--gray-400)', fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      value={customBasic}
                      onChange={e => setCustomBasic(e.target.value)}
                      style={{ padding: '8px 12px 8px 24px', width: '100%', borderRadius: 8, border: '1px solid var(--gray-300)', fontSize: 13 }}
                    />
                  </div>
                  <button
                    onClick={handleUpdateBasicSalary}
                    disabled={savingBasic}
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '8px 14px' }}
                  >
                    {savingBasic ? 'Saving...' : 'Update'}
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4, display: 'block' }}>
                  Setting a basic salary will dynamically update allowance & deduction ratios.
                </span>
              </div>

              {/* Financial Breakdown Cohorts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, marginBottom: 24 }}>

                {/* 1. Basic */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--gray-100)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--gray-600)', fontWeight: 600 }}>Employee Basic Salary</span>
                  <strong style={{ color: 'var(--gray-900)' }}>₹{(selectedEmployee.basic || 0).toLocaleString('en-IN')}</strong>
                </div>

                {/* 2. Allowances */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#047857', marginBottom: 6 }}>
                    <span>Space Allowances</span>
                    <span>+₹{(selectedEmployee.totalAllowances || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ paddingLeft: 12, borderLeft: '2px solid #34D399', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedEmployee.allowances && selectedEmployee.allowances.length > 0 ? (
                      selectedEmployee.allowances.map((rule, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-600)' }}>
                          <span>{rule.name || rule.Name} ({rule.type === 'Percentage' ? `${rule.value}%` : `Fixed`})</span>
                          <span>+₹{(rule.amount || rule.Amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>No allowances configured.</span>
                    )}
                  </div>
                </div>

                {/* 3. Deductions */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#B91C1C', marginBottom: 6 }}>
                    <span>Space Deductions</span>
                    <span>-₹{(selectedEmployee.totalDeductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ paddingLeft: 12, borderLeft: '2px solid #FCA5A5', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedEmployee.deductions && selectedEmployee.deductions.length > 0 ? (
                      selectedEmployee.deductions.map((rule, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-600)' }}>
                          <span>{rule.name || rule.Name} ({rule.type === 'Percentage' ? `${rule.value}%` : `Fixed`})</span>
                          <span>-₹{(rule.amount || rule.Amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>No deductions configured.</span>
                    )}
                  </div>
                </div>

                {/* 4. Performance Penalties */}
                {applyPenalties && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#991B1B', marginBottom: 6 }}>
                      <span>Performance Penalties</span>
                      <span>-₹{(selectedEmployee.totalPerformanceDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ paddingLeft: 12, borderLeft: '2px solid #EF4444', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedEmployee.incompleteReasons && selectedEmployee.incompleteReasons.length > 0 ? (
                        selectedEmployee.incompleteReasons.map((reason, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7F1D1D' }}>
                            <span>{reason.split(':')[0]}</span>
                            <span>{reason.split(':')[1] || ''}</span>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Clean performance sheet.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Summary Net */}
                <div style={{
                  marginTop: 8,
                  padding: '12px 0',
                  borderTop: '2px solid var(--gray-200)',
                  borderBottom: '2px solid var(--gray-200)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--gray-900)'
                }}>
                  <span>Calculated Net Salary:</span>
                  <span>₹{(selectedEmployee.finalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

              </div>

              {/* Form 2: Payout Override (Rupees) */}
              <div style={{
                background: '#FFFBEB',
                padding: 16,
                borderRadius: 12,
                border: '1px solid #FDE68A',
                marginBottom: 24
              }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#92400E', display: 'block', marginBottom: 6 }}>
                  ⚠️ Manual Payout Override (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: 8, fontSize: 13, color: '#B45309', fontWeight: 600 }}>₹</span>
                  <input
                    type="number"
                    placeholder="Enter custom payout amount (leave empty for calculated)"
                    value={overrideAmount}
                    onChange={e => setOverrideAmount(e.target.value)}
                    style={{ padding: '8px 12px 8px 24px', width: '100%', borderRadius: 8, border: '1px solid #FCD34D', fontSize: 13 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: '#B45309', marginTop: 6, display: 'block' }}>
                  *Inputting an override bypasses all calculations. This payout amount is saved directly in payments and payslips.
                </span>
              </div>

              {/* Drawer Action Checkout Footer */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedEmployee(null)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={paying || isPaid(selectedEmployee)}
                  onClick={() => triggerCheckout([selectedEmployee], overrideAmount, selectedEmployee.basic || selectedEmployee.Basic)}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: isPaid(selectedEmployee) ? 'var(--gray-300)' : '#4F46E5',
                    borderColor: isPaid(selectedEmployee) ? 'var(--gray-300)' : '#4F46E5'
                  }}
                >
                  {isPaid(selectedEmployee) ? 'Already Paid' : 'Execute Checkout'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
