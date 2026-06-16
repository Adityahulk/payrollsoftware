import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { spacesApi } from '../api/index';
import { leavesApi } from '../api/leaves';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function SpacesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [mySpace, setMySpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('departments'); // 'departments' or 'contracts'

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [payoutModal, setPayoutModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState(null);

  // Forms
  const [formData, setFormData] = useState({
    spaceName: '',
    numberOfEmployees: 100,
    numberOfBreaks: 2,
    breakTime: 60,
    workStartTime: '09:00:00',
    workEndTime: '18:00:00',
    workingHours: 8,
    type: 'Department',
    endDate: '',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  });

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleWorkingDay = (day) => {
    setFormData(prev => {
      const current = prev.workingDays || [];
      const newDays = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      const sortedDays = DAYS_OF_WEEK.filter(d => newDays.includes(d));
      return { ...prev, workingDays: sortedDays };
    });
  };
  
  const [payoutData, setPayoutData] = useState({
    amount: 50000,
    paymentMethod: 'UPI',
    transactionId: ''
  });
  const [contractPaymentInfo, setContractPaymentInfo] = useState(null);
  const [contractPayslips, setContractPayslips] = useState([]);

  // Leave policy config (per space)
  const [leaveConfig, setLeaveConfig] = useState({
    emergencyLeavesPerMonth: 1,
    collegeLeavesPerMonth: 1,
  });
  const [leaveConfigLoading, setLeaveConfigLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const role = user?.role || 'Employee';
  const myEmpId = user?.empId || user?.EmpId;
  const mySpaceId = user?.spaceId || user?.SpaceId;

  const ensureSeconds = (timeStr) => {
    if (!timeStr) return null;
    if (timeStr.length === 5) return timeStr + ':00';
    return timeStr;
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (role === 'Admin') {
        const deptRes = await spacesApi.getDepartmentsByAdmin(myEmpId);
        const contRes = await spacesApi.getContractsByAdmin(myEmpId);
        setDepartments(deptRes.data || []);
        setContracts(contRes.data || []);
        setSpaces([...(deptRes.data || []), ...(contRes.data || [])]);
      } else if (role === 'TeamLead') {
        const allSpacesRes = await spacesApi.getSpaces();
        const list = allSpacesRes.data || [];
        const tlSpace = list.find(s => s.spaceId === mySpaceId || s.SpaceId === mySpaceId);
        if (tlSpace) {
          const adminId = tlSpace.adminId || tlSpace.AdminId;
          const spacesRes = await spacesApi.getSpacesByAdmin(adminId);
          const activeList = spacesRes.data || [];
          setSpaces(activeList);
          setDepartments(activeList.filter(s => s.type === 'Department'));
          setContracts(activeList.filter(s => s.type === 'Contract' || s.type === 'Completed'));
          
          const employeesRes = await spacesApi.getAllEmployeesByAdmin(adminId);
          setEmployees(employeesRes.data || []);
        }
      } else if (role === 'Manager' || role === 'AssistantManager') {
        const allSpacesRes = await spacesApi.getSpaces();
        const list = allSpacesRes.data || [];
        const managerSpace = list.find(s => s.spaceId === mySpaceId || s.SpaceId === mySpaceId);
        if (managerSpace) {
          setMySpace(managerSpace);
          setFormData({
            spaceName: managerSpace.spaceName || managerSpace.SpaceName || '',
            numberOfEmployees: managerSpace.numberOfEmployees ?? managerSpace.NumberOfEmployees ?? 100,
            numberOfBreaks: managerSpace.numberOfBreaks ?? managerSpace.NumberOfBreaks ?? 2,
            breakTime: managerSpace.breakTime ?? managerSpace.BreakTime ?? 60,
            workStartTime: managerSpace.workStartTime ?? managerSpace.WorkStartTime ?? '09:00:00',
            workEndTime: managerSpace.workEndTime ?? managerSpace.WorkEndTime ?? '18:00:00',
            workingHours: managerSpace.workingHours ?? managerSpace.WorkingHours ?? 8,
            type: managerSpace.type || 'Department',
            endDate: managerSpace.endDate ? managerSpace.endDate.split('T')[0] : '',
            workingDays: managerSpace.workingDays || managerSpace.WorkingDaysList || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
          });
          
          const empRes = await spacesApi.getEmployeesBySpace(mySpaceId);
          setEmployees(empRes.data || []);
        }
      } else {
        const allSpacesRes = await spacesApi.getSpaces();
        const list = allSpacesRes.data || [];
        const empSpace = list.find(s => s.spaceId === mySpaceId || s.SpaceId === mySpaceId);
        if (empSpace) {
          setMySpace(empSpace);
        }
      }
    } catch (err) {
      console.warn('Error fetching space details.', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!formData.spaceName.trim()) {
      toast.error('Space name is required');
      return;
    }

    try {
      const payload = {
        spaceName: formData.spaceName.trim(),
        adminId: myEmpId,
        numberOfEmployees: parseInt(formData.numberOfEmployees) || 100,
        numberOfBreaks: parseInt(formData.numberOfBreaks) || 2,
        breakTime: parseInt(formData.breakTime) || 60,
        workStartTime: ensureSeconds(formData.workStartTime) || '09:00:00',
        workEndTime: ensureSeconds(formData.workEndTime) || '18:00:00',
        workingHours: parseInt(formData.workingHours) || 8,
        type: formData.type || 'Department',
        endDate: formData.type === 'Contract' && formData.endDate ? formData.endDate : null,
        workingDays: formData.workingDays
      };

      await spacesApi.createSpace(payload);
      toast.success(`${payload.type} created successfully!`);

      // Save leave policy config for the new space
      // We need to reload to get the new spaceId, then save config
      const freshDepts = await spacesApi.getDepartmentsByAdmin(myEmpId).catch(() => ({ data: [] }));
      const freshConts = await spacesApi.getContractsByAdmin(myEmpId).catch(() => ({ data: [] }));
      const allNew = [...(freshDepts.data || []), ...(freshConts.data || [])];
      const newestSpace = allNew.sort((a, b) => (b.spaceId || b.SpaceId) - (a.spaceId || a.SpaceId))[0];
      if (newestSpace) {
        const newSpId = newestSpace.spaceId || newestSpace.SpaceId;
        await leavesApi.updateLeaveConfig(newSpId, {
          spaceId: newSpId,
          emergencyLeavesPerMonth: parseInt(leaveConfig.emergencyLeavesPerMonth) || 1,
          collegeLeavesPerMonth: parseInt(leaveConfig.collegeLeavesPerMonth) || 1,
          normalLeavesPerMonth: 999,
        }).catch(() => {});
      }

      setCreateModal(false);
      setFormData({
        spaceName: '',
        numberOfEmployees: 100,
        numberOfBreaks: 2,
        breakTime: 60,
        workStartTime: '09:00:00',
        workEndTime: '18:00:00',
        workingHours: 8,
        type: 'Department',
        endDate: '',
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      });
      setLeaveConfig({ emergencyLeavesPerMonth: 1, collegeLeavesPerMonth: 1 });
      loadData();
    } catch (err) {
      toast.error('Failed to create space.');
    }
  };

  const handleUpdateSpace = async (e) => {
    e.preventDefault();
    if (!formData.spaceName.trim()) {
      toast.error('Space name is required');
      return;
    }

    try {
      const targetSpaceId = role === 'Admin' ? selectedSpace?.spaceId || selectedSpace?.SpaceId : mySpaceId;
      const payload = {
        spaceId: targetSpaceId,
        spaceName: formData.spaceName.trim(),
        numberOfEmployees: parseInt(formData.numberOfEmployees) || 100,
        numberOfBreaks: parseInt(formData.numberOfBreaks) || 2,
        breakTime: parseInt(formData.breakTime) || 60,
        workStartTime: ensureSeconds(formData.workStartTime) || '09:00:00',
        workEndTime: ensureSeconds(formData.workEndTime) || '18:00:00',
        workingHours: parseInt(formData.workingHours) || 8,
        type: formData.type,
        endDate: formData.type === 'Contract' && formData.endDate ? formData.endDate : null,
        workingDays: formData.workingDays
      };

      await spacesApi.updateSpace(targetSpaceId, payload);

      // Save leave policy
      await leavesApi.updateLeaveConfig(targetSpaceId, {
        spaceId: targetSpaceId,
        emergencyLeavesPerMonth: parseInt(leaveConfig.emergencyLeavesPerMonth) || 1,
        collegeLeavesPerMonth: parseInt(leaveConfig.collegeLeavesPerMonth) || 1,
        normalLeavesPerMonth: 999,
      }).catch(() => {});

      toast.success('Space updated successfully!');
      setEditModal(false);
      loadData();
    } catch (err) {
      toast.error('Failed to update space.');
    }
  };

  const handleDeleteSpace = async (spaceId) => {
    if (!window.confirm('Are you sure you want to deactivate this space? Roster logs remain but it will be hidden.')) {
      return;
    }

    try {
      await spacesApi.deleteSpace(spaceId);
      toast.success('Space deactivated.');
      loadData();
    } catch (err) {
      toast.error('Failed to deactivate space.');
    }
  };

  const openEditModal = async (sp) => {
    setSelectedSpace(sp);
    setFormData({
      spaceName: sp.spaceName || sp.SpaceName || '',
      numberOfEmployees: sp.numberOfEmployees ?? sp.NumberOfEmployees ?? 100,
      numberOfBreaks: sp.numberOfBreaks ?? sp.NumberOfBreaks ?? 2,
      breakTime: sp.breakTime ?? sp.BreakTime ?? 60,
      workStartTime: sp.workStartTime ?? sp.WorkStartTime ?? '09:00:00',
      workEndTime: sp.workEndTime ?? sp.WorkEndTime ?? '18:00:00',
      workingHours: sp.workingHours ?? sp.WorkingHours ?? 8,
      type: sp.type || 'Department',
      endDate: sp.endDate ? sp.endDate.split('T')[0] : '',
      workingDays: sp.workingDays || sp.WorkingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    });
    // Load existing leave config for this space
    const spId = sp.spaceId || sp.SpaceId;
    setLeaveConfigLoading(true);
    try {
      const cfgRes = await leavesApi.getLeaveConfig(spId);
      const cfg = cfgRes.data;
      setLeaveConfig({
        emergencyLeavesPerMonth: cfg.emergencyLeavesPerMonth ?? cfg.EmergencyLeavesPerMonth ?? 1,
        collegeLeavesPerMonth: cfg.collegeLeavesPerMonth ?? cfg.CollegeLeavesPerMonth ?? 1,
      });
    } catch {
      setLeaveConfig({ emergencyLeavesPerMonth: 1, collegeLeavesPerMonth: 1 });
    } finally {
      setLeaveConfigLoading(false);
    }
    setEditModal(true);
  };

  const openPayoutModal = async (sp) => {
    setSelectedSpace(sp);
    setPayoutData({
      amount: 50000,
      paymentMethod: 'UPI',
      transactionId: ''
    });
    setContractPaymentInfo(null);
    setContractPayslips([]);
    setPayoutModal(true);

    try {
      const spId = sp.spaceId || sp.SpaceId;
      const res = await spacesApi.getContractPayment(spId);
      setContractPaymentInfo(res.data);
      if (res.data && res.data.amount) {
        setPayoutData(p => ({ ...p, amount: res.data.amount, transactionId: res.data.transactionId || '' }));
      }
      
      const slipsRes = await spacesApi.getContractPayslips(spId);
      setContractPayslips(slipsRes.data || []);
    } catch (err) {
      console.error('Error fetching payout info', err);
    }
  };

  const handleProcessPayout = async (e) => {
    e.preventDefault();
    if (!selectedSpace) return;
    const spId = selectedSpace.spaceId || selectedSpace.SpaceId;

    try {
      await spacesApi.payContract(spId, {
        amount: parseFloat(payoutData.amount) || 50000,
        paymentMethod: payoutData.paymentMethod,
        transactionId: payoutData.transactionId
      });
      toast.success('Payout executed and batch employee payslips logged successfully!');
      
      const res = await spacesApi.getContractPayment(spId);
      setContractPaymentInfo(res.data);
      const slipsRes = await spacesApi.getContractPayslips(spId);
      setContractPayslips(slipsRes.data || []);
      
      loadData();
    } catch (err) {
      toast.error('Failed to register contract payment.');
    }
  };

  const totalDepartments = departments.length;
  const totalContracts = contracts.length;
  const totalEmployeesCount = spaces.reduce((sum, sp) => sum + (sp.totalEmployees || sp.TotalEmployees || 0), 0);

  const filteredEmployees = employees.filter(emp => 
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(emp.empId || emp.EmpId).includes(searchTerm)
  );

  return (
    <AppLayout role={role.toLowerCase() === 'admin' ? 'admin' : role.toLowerCase() === 'teamlead' ? 'teamlead' : 'employee'}>
      <div className="page-content fade-in" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
        
        {/* TOP HEADER */}
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 6, letterSpacing: '-0.02em' }}>
              {role === 'Admin' ? 'Corporate Multi-Space Registry' : role === 'TeamLead' ? 'Cross-Department Workspace' : 'Space Workspace'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
              {role === 'Admin' ? 'Manage department structures, custom delivery contracts, workforce counts, and check out payroll metrics.' :
               role === 'TeamLead' ? 'Collaborate across all corporate departments and access multi-tenant employee rosters.' :
               'Access guidelines, resource repositories, and shift configurations.'}
            </p>
          </div>
          {role === 'Admin' && (
            <button className="btn btn-primary" onClick={() => { 
              setFormData({ 
                spaceName: '', 
                numberOfEmployees: 100,
                numberOfBreaks: 2,
                breakTime: 60,
                workStartTime: '09:00:00',
                workEndTime: '18:00:00',
                workingHours: 8,
                type: 'Department',
                endDate: '',
                workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
              }); 
              setCreateModal(true); 
            }} style={{ gap: 8, padding: '10px 20px', borderRadius: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
              Create Workspace Space
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--gray-400)' }}>
            <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>Loading corporate registry...</div>
          </div>
        ) : (
          <>
            {/* ==================== ADMIN VIEW ==================== */}
            {role === 'Admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                
                {/* Admin Statistics Bar */}
                <div className="grid grid-3" style={{ gap: 20 }}>
                  <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '5px solid var(--primary-500)' }}>
                    <div style={{ background: 'var(--primary-50)', padding: 12, borderRadius: 12, color: 'var(--primary-600)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>corporate_fare</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Departments</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)' }}>{totalDepartments} Active</div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '5px solid #8B5CF6' }}>
                    <div style={{ background: '#F5F3FF', padding: 12, borderRadius: 12, color: '#7C3AED' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>handshake</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Contracts</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)' }}>{totalContracts} Registered</div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, borderLeft: '5px solid var(--success-500)' }}>
                    <div style={{ background: 'var(--success-50)', padding: 12, borderRadius: 12, color: 'var(--success-600)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>groups</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Workforce Size</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)' }}>{totalEmployeesCount} Employees</div>
                    </div>
                  </div>
                </div>

                {/* Gorgeous Premium Tabs Control */}
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--gray-100)', paddingBottom: 0 }}>
                  <button 
                    onClick={() => setActiveTab('departments')} 
                    style={{
                      padding: '12px 24px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'departments' ? '3px solid var(--primary-500)' : '3px solid transparent',
                      color: activeTab === 'departments' ? 'var(--primary-700)' : 'var(--gray-500)',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>corporate_fare</span>
                    Departments ({totalDepartments})
                  </button>
                  <button 
                    onClick={() => setActiveTab('contracts')} 
                    style={{
                      padding: '12px 24px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'contracts' ? '3px solid #8B5CF6' : '3px solid transparent',
                      color: activeTab === 'contracts' ? '#7C3AED' : 'var(--gray-500)',
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>handshake</span>
                    Contracts & Delivery ({totalContracts})
                  </button>
                </div>

                {/* Display Lists */}
                {activeTab === 'departments' ? (
                  <div>
                    {departments.length === 0 ? (
                      <div className="card" style={{ padding: 40, textAlign: 'center', border: '2px dashed var(--gray-200)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--gray-300)', marginBottom: 12 }}>corporate_fare</span>
                        <h4 style={{ fontSize: 16, fontWeight: 700 }}>No Departments Configured</h4>
                        <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Click "Create Workspace Space" and select Department type.</p>
                      </div>
                    ) : (
                      <div className="grid grid-3" style={{ gap: 24 }}>
                        {departments.map((sp) => {
                          const spId = sp.spaceId || sp.SpaceId;
                          const spName = sp.spaceName || sp.SpaceName;
                          const empCount = sp.totalEmployees || sp.TotalEmployees || 0;
                          const maxLimit = sp.numberOfEmployees || sp.NumberOfEmployees || 100;

                          return (
                            <div className="card h-100" key={spId} style={{
                              padding: 24,
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              border: '1px solid var(--gray-100)'
                            }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: 'var(--primary-50)',
                                    color: 'var(--primary-700)',
                                    padding: '4px 8px',
                                    borderRadius: 6
                                  }}>Dept #{spId}</span>
                                  <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500 }}>
                                    Limit: {maxLimit}
                                  </span>
                                </div>
                                <h4 style={{ fontSize: 19, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 2 }}>{spName}</h4>
                                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                                  <span>Space ID: <strong style={{ color: 'var(--primary-600)', fontFamily: 'monospace', fontSize: 13 }}>{spId}</strong></span>
                                  {(sp.createdAt || sp.CreatedAt) && (
                                    <span>Created: <strong>{new Date(sp.createdAt || sp.CreatedAt).toLocaleDateString()}</strong></span>
                                  )}
                                </div>
                                
                                <div style={{ margin: '16px 0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>
                                    <span>Roster Load</span>
                                    <strong>{empCount} / {maxLimit} Employees</strong>
                                  </div>
                                  <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%',
                                      width: `${Math.min((empCount / maxLimit) * 100, 100)}%`,
                                      background: 'linear-gradient(90deg, var(--primary-500) 0%, var(--primary-600) 100%)',
                                      borderRadius: 3
                                    }} />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 }}>
                                  <span style={{
                                    fontSize: 11,
                                    background: 'var(--gray-50)',
                                    color: 'var(--gray-600)',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                                    {sp.workStartTime || sp.WorkStartTime || '09:00'} - {sp.workEndTime || sp.WorkEndTime || '18:00'}
                                  </span>
                                  <span style={{
                                    fontSize: 11,
                                    background: 'var(--gray-50)',
                                    color: 'var(--gray-600)',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>coffee</span>
                                    {sp.numberOfBreaks || sp.NumberOfBreaks || 2} Breaks
                                  </span>
                                  <span style={{
                                    fontSize: 11,
                                    background: 'var(--primary-50)',
                                    color: 'var(--primary-700)',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_month</span>
                                    {sp.workingDays && sp.workingDays.length > 0
                                      ? sp.workingDays.join(', ')
                                      : 'Mon, Tue, Wed, Thu, Fri'}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, borderTop: '1px solid var(--gray-50)', paddingTop: 16 }}>
                                <button className="btn btn-primary" onClick={() => navigate(`/payroll/${spId}`)} style={{ gap: 8, justifyContent: 'center' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
                                  Performance Payroll
                                </button>
                                
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button className="btn btn-secondary" onClick={() => openEditModal(sp)} style={{ flex: 1, padding: '8px 12px', fontSize: 12, gap: 4, justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>settings</span>
                                    Configure
                                  </button>
                                  <button className="btn" onClick={() => handleDeleteSpace(spId)} style={{
                                    padding: '8px 12px',
                                    fontSize: 12,
                                    background: '#FEF2F2',
                                    color: '#EF4444',
                                    border: '1px solid #FEE2E2',
                                    gap: 4,
                                    justifyContent: 'center'
                                  }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                                    Deactivate
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {contracts.length === 0 ? (
                      <div className="card" style={{ padding: 40, textAlign: 'center', border: '2px dashed var(--gray-200)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--gray-300)', marginBottom: 12 }}>handshake</span>
                        <h4 style={{ fontSize: 16, fontWeight: 700 }}>No Contracts Registered</h4>
                        <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Click "Create Workspace Space" and select Contract type.</p>
                      </div>
                    ) : (
                      <div className="grid grid-3" style={{ gap: 24 }}>
                        {contracts.map((sp) => {
                          const spId = sp.spaceId || sp.SpaceId;
                          const spName = sp.spaceName || sp.SpaceName;
                          const empCount = sp.totalEmployees || sp.TotalEmployees || 0;
                          const isExpired = sp.type === 'Completed';
                          const expiryDate = sp.endDate || sp.EndDate;

                          return (
                            <div className="card h-100" key={spId} style={{
                              padding: 24,
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              border: isExpired ? '1px solid #E5E7EB' : '1px solid #DDD6FE',
                              background: isExpired ? '#F9FAFB' : '#FFF'
                            }}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: isExpired ? '#E5E7EB' : '#EDE9FE',
                                    color: isExpired ? '#4B5563' : '#6D28D9',
                                    padding: '4px 8px',
                                    borderRadius: 6
                                  }}>Contract #{spId}</span>
                                  
                                  <span className={`badge ${isExpired ? 'badge-neutral' : 'badge-primary'}`} style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: isExpired ? '#F3F4F6' : '#F5F3FF',
                                    color: isExpired ? '#6B7280' : '#7C3AED'
                                  }}>
                                    {isExpired ? 'Completed' : 'Active Contract'}
                                  </span>
                                </div>
                                <h4 style={{ fontSize: 19, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 2 }}>{spName}</h4>
                                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                                  <span>Space ID: <strong style={{ color: '#7C3AED', fontFamily: 'monospace', fontSize: 13 }}>{spId}</strong></span>
                                  {(sp.createdAt || sp.CreatedAt) && (
                                    <span>Created: <strong>{new Date(sp.createdAt || sp.CreatedAt).toLocaleDateString()}</strong></span>
                                  )}
                                </div>
                                
                                <div style={{ margin: '14px 0', fontSize: 13, color: 'var(--gray-500)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>Registered Roster:</span>
                                    <strong style={{ color: 'var(--gray-900)' }}>{empCount} Employees</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>Expiration Date:</span>
                                    <strong style={{ color: isExpired ? '#EF4444' : '#10B981' }}>
                                      {expiryDate ? new Date(expiryDate).toLocaleDateString() : 'No Limit'}
                                    </strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Working Days:</span>
                                    <strong style={{ color: 'var(--primary-700)' }}>
                                      {sp.workingDays && sp.workingDays.length > 0
                                        ? sp.workingDays.join(', ')
                                        : 'Mon, Tue, Wed, Thu, Fri'}
                                    </strong>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, borderTop: '1px solid var(--gray-50)', paddingTop: 16 }}>
                                <button className="btn" onClick={() => openPayoutModal(sp)} style={{
                                  gap: 8,
                                  justifyContent: 'center',
                                  background: isExpired ? '#7C3AED' : '#F5F3FF',
                                  color: isExpired ? '#FFF' : '#7C3AED',
                                  border: isExpired ? 'none' : '1px solid #DDD6FE'
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                                  Payout & Payslips
                                </button>
                                
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button className="btn btn-secondary" onClick={() => openEditModal(sp)} style={{ flex: 1, padding: '8px 12px', fontSize: 12, gap: 4, justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>settings</span>
                                    Configure
                                  </button>
                                  <button className="btn" onClick={() => handleDeleteSpace(spId)} style={{
                                    padding: '8px 12px',
                                    fontSize: 12,
                                    background: '#FEF2F2',
                                    color: '#EF4444',
                                    border: '1px solid #FEE2E2',
                                    gap: 4,
                                    justifyContent: 'center'
                                  }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                                    Deactivate
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ==================== MANAGER VIEW ==================== */}
            {(role === 'Manager' || role === 'AssistantManager') && mySpace && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                
                <div className="grid grid-2" style={{ gap: 24 }}>
                  <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase' }}>
                          Operational Workspace
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: mySpace.type === 'Contract' || mySpace.type === 'Completed' ? '#F5F3FF' : 'var(--primary-50)',
                          color: mySpace.type === 'Contract' || mySpace.type === 'Completed' ? '#7C3AED' : 'var(--primary-700)',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          {mySpace.type || 'Department'}
                        </span>
                      </div>
                      <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 12 }}>
                        {mySpace.spaceName || mySpace.SpaceName}
                      </h2>
                      <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 20 }}>
                        As a designated manager, you can update the department parameters and manage employees allocated to this segment.
                      </p>
                      
                      <div style={{ display: 'flex', gap: 24, fontSize: 13, borderTop: '1px solid var(--gray-100)', paddingTop: 16 }}>
                        <div>
                          <div style={{ color: 'var(--gray-400)', fontSize: 11, fontWeight: 600 }}>SPACE ID</div>
                          <strong style={{ fontSize: 15 }}>#{mySpace.spaceId || mySpace.SpaceId}</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--gray-400)', fontSize: 11, fontWeight: 600 }}>CAPACITY LIMIT</div>
                          <strong style={{ fontSize: 15 }}>{mySpace.numberOfEmployees ?? mySpace.NumberOfEmployees ?? 100}</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--gray-400)', fontSize: 11, fontWeight: 600 }}>ACTIVE ROSTER</div>
                          <strong style={{ fontSize: 15 }}>{employees.length}</strong>
                        </div>
                      </div>
                    </div>

                    <button className="btn btn-primary" onClick={() => openEditModal(mySpace)} style={{ marginTop: 24, gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                      Configure Space & Shift Parameters
                    </button>
                  </div>

                  <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-500)' }}>schedule</span>
                      Shift & Break Parameters
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Shift Start</span>
                        <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>{mySpace.workStartTime || mySpace.WorkStartTime || '09:00:00'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Shift End</span>
                        <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>{mySpace.workEndTime || mySpace.WorkEndTime || '18:00:00'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Working Hours</span>
                        <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>{mySpace.workingHours || mySpace.WorkingHours || 8} Hours</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Break Count</span>
                        <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>{mySpace.numberOfBreaks || mySpace.NumberOfBreaks || 2} Breaks</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Break Duration</span>
                        <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>{mySpace.breakTime || mySpace.BreakTime || 60} Minutes</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Working Days</span>
                        <strong style={{ fontSize: 13, color: 'var(--primary-700)' }}>
                          {mySpace.workingDays && mySpace.workingDays.length > 0
                            ? mySpace.workingDays.join(', ')
                            : 'Mon, Tue, Wed, Thu, Fri'}
                        </strong>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Employees Roster */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Department Roster</h3>
                  {employees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 28, color: 'var(--gray-400)' }}>No employees assigned to this space yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ width: '100%', minWidth: 600 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Employee ID</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Role</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employees.map(emp => (
                            <tr key={emp.empId || emp.EmpId} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{emp.empId || emp.EmpId}</td>
                              <td style={{ padding: '12px 16px' }}>{emp.email}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span className={`badge ${emp.role === 'Manager' ? 'badge-primary' : 'badge-neutral'}`}>
                                  {emp.role}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span className={`badge ${emp.status === 'Active' ? 'badge-success' : 'badge-error'}`}>
                                  {emp.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ==================== TEAM LEAD VIEW ==================== */}
            {role === 'TeamLead' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                
                <div className="grid grid-2" style={{ gap: 20 }}>
                  <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'var(--primary-50)', padding: 12, borderRadius: 12, color: 'var(--primary-600)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>account_tree</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Departments Administered</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{totalDepartments}</div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'var(--success-50)', padding: 12, borderRadius: 12, color: 'var(--success-600)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>share</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>Cross-Space Roster Access</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' }}>{employees.length} Active Users</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--gray-900)' }}>Active Corporate Spaces</h3>
                  <div className="grid grid-4" style={{ gap: 16 }}>
                    {spaces.map(sp => (
                      <div className="card" key={sp.spaceId || sp.SpaceId} style={{ padding: 16, background: '#FAFAFA' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)' }}>DEPT #{sp.spaceId || sp.SpaceId}</span>
                          <span style={{ fontSize: 10, background: sp.type === 'Contract' ? '#F5F3FF' : '#E0F2FE', color: sp.type === 'Contract' ? '#7C3AED' : '#0369A1', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>
                            {sp.type || 'Department'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)', margin: '4px 0 8px' }}>
                          {sp.spaceName || sp.SpaceName}
                        </h4>
                        <div style={{ fontSize: 12, color: 'var(--primary-600)', fontWeight: 600 }}>
                          {sp.totalEmployees || sp.TotalEmployees || 0} Staff Members
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cross Space Employees Directory */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700 }}>Cross-Department Employee Directory</h3>
                      <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>Search and view all employees across all spaces owned by your Admin.</p>
                    </div>
                    
                    <div style={{ position: 'relative', width: 280 }}>
                      <span className="material-symbols-outlined" style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--gray-400)',
                        fontSize: 18
                      }}>search</span>
                      <input
                        type="text"
                        placeholder="Search by ID, role, or email..."
                        className="form-input"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: 38, fontSize: 13, borderRadius: 8, height: 38 }}
                      />
                    </div>
                  </div>

                  {filteredEmployees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
                      No employees match your search query.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ width: '100%', minWidth: 650 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Employee ID</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Email Address</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Allocated Department</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Role</th>
                            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEmployees.map(emp => {
                            const empSpaceName = spaces.find(s => (s.spaceId === emp.spaceId || s.SpaceId === emp.spaceId))?.spaceName || 'General';
                            return (
                               <tr key={emp.empId || emp.EmpId} style={{ borderBottom: '1px solid var(--gray-50)', transition: 'background-color 0.2s' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 700 }}>#{emp.empId || emp.EmpId}</td>
                                <td style={{ padding: '12px 16px' }}>{emp.email}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '4px 8px', borderRadius: 6 }}>
                                    {empSpaceName}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span className={`badge ${emp.role === 'TeamLead' ? 'badge-warning' : emp.role === 'Manager' ? 'badge-primary' : 'badge-neutral'}`}>
                                    {emp.role}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span className={`badge ${emp.status === 'Active' ? 'badge-success' : 'badge-error'}`}>
                                    {emp.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ==================== EMPLOYEE VIEW ==================== */}
            {role === 'Employee' && mySpace && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="card" style={{
                  background: 'linear-gradient(135deg, var(--primary-600) 0%, #312E81 100%)',
                  color: '#fff',
                  padding: 28,
                  borderRadius: 16,
                  boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 20
                }}>
                  <div>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, opacity: 0.8 }}>Allocated Space</span>
                    <h2 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0 8px' }}>
                      {mySpace.spaceName || mySpace.SpaceName}
                    </h2>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      Space Identification Code: <strong>#{mySpace.spaceId || mySpace.SpaceId}</strong> ({mySpace.type || 'Department'})
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.1)',
                    padding: '12px 20px',
                    borderRadius: 12,
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>AUTHORIZED USER</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{user?.name || user?.email}</div>
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: 24 }}>
                  <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Department Guidelines</h3>
                    <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.5 }}>
                      You are linked to {mySpace.spaceName || mySpace.SpaceName}. Core attendance, working logs, and salary details are computed with respect to this workspace's parameters. Direct any queries to your assigned Space Manager or Team Lead.
                    </p>
                  </div>
                  <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Resources & Links</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <a href="#/" onClick={e => e.preventDefault()} className="resource-link" style={{ display: 'flex', padding: 10, background: 'var(--gray-50)', borderRadius: 8, color: 'var(--gray-700)', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                        <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 18, color: 'var(--gray-400)' }}>description</span>
                        Space Handbook
                      </a>
                      <a href="#/" onClick={e => e.preventDefault()} className="resource-link" style={{ display: 'flex', padding: 10, background: 'var(--gray-50)', borderRadius: 8, color: 'var(--gray-700)', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                        <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 18, color: 'var(--gray-400)' }}>help</span>
                        Internal FAQs
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== CREATE SPACE MODAL (ADMIN ONLY) ==================== */}
        {createModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal" style={{ maxWidth: 450 }}>
              <div className="modal-header">
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Create Corporate Space</h3>
                <button className="icon-btn" onClick={() => setCreateModal(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleCreateSpace}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  <div className="form-group">
                    <label className="form-label">Space Type *</label>
                    <select 
                      className="form-input" 
                      value={formData.type} 
                      onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}
                      style={{ background: '#FFF' }}
                    >
                      <option value="Department">Department (General department payroll)</option>
                      <option value="Contract">Contract (Special project contract with end date)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Space Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.spaceName}
                      onChange={e => setFormData(p => ({ ...p, spaceName: e.target.value }))}
                      placeholder={formData.type === 'Contract' ? "e.g. Acme Website Overhaul Project" : "e.g. Sales, Human Resources, Engineering"}
                      required
                    />
                  </div>

                  {formData.type === 'Contract' && (
                    <div className="form-group">
                      <label className="form-label">Contract End Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.endDate}
                        onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                        required
                      />
                      <span className="form-hint">Once this date passes, the contract automatically transitions to 'Completed'.</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Workforce Capacity Limit *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.numberOfEmployees}
                      onChange={e => setFormData(p => ({ ...p, numberOfEmployees: e.target.value }))}
                      required
                    />
                    <span className="form-hint">Maximum number of employees allowed in this segment.</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>Working Days *</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {DAYS_OF_WEEK.map(day => {
                        const isSelected = (formData.workingDays || []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleWorkingDay(day)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600',
                              border: isSelected ? '1px solid var(--primary-500)' : '1px solid var(--gray-200)',
                              background: isSelected ? 'var(--primary-50)' : '#FFF',
                              color: isSelected ? 'var(--primary-700)' : 'var(--gray-600)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              outline: 'none'
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <span className="form-hint" style={{ marginTop: 4, display: 'block' }}>Select the weekly working days for attendance and penalty calculations.</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Shift Start Time *</label>
                      <input
                        type="time"
                        step="1"
                        className="form-input"
                        value={formData.workStartTime}
                        onChange={e => setFormData(p => ({ ...p, workStartTime: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Shift End Time *</label>
                      <input
                        type="time"
                        step="1"
                        className="form-input"
                        value={formData.workEndTime}
                        onChange={e => setFormData(p => ({ ...p, workEndTime: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Daily Breaks *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.numberOfBreaks}
                        onChange={e => setFormData(p => ({ ...p, numberOfBreaks: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Break Duration (m) *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.breakTime}
                        onChange={e => setFormData(p => ({ ...p, breakTime: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Shift Duration (h) *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.workingHours}
                        onChange={e => setFormData(p => ({ ...p, workingHours: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* ─── Leave Policy ────────────────────────────────── */}
                <div style={{ padding: '0 20px 4px' }}>
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)',
                    border: '1px solid #FCD34D',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#B45309' }}>event_busy</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Leave Policy — Monthly Limits</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>🚨 Emergency / Month</label>
                        <input
                          type="number" min="0" max="30"
                          className="form-input"
                          value={leaveConfig.emergencyLeavesPerMonth}
                          onChange={e => setLeaveConfig(p => ({ ...p, emergencyLeavesPerMonth: e.target.value }))}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>🎓 College / Month</label>
                        <input
                          type="number" min="0" max="30"
                          className="form-input"
                          value={leaveConfig.collegeLeavesPerMonth}
                          onChange={e => setLeaveConfig(p => ({ ...p, collegeLeavesPerMonth: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#92400E', marginTop: 6 }}>
                      Normal leaves are unlimited. Emergency &amp; College are capped per month.
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Space</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== EDIT SPACE MODAL (ADMIN & MANAGER) ==================== */}
        {editModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal" style={{ maxWidth: 450 }}>
              <div className="modal-header">
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Configure Space Settings</h3>
                <button className="icon-btn" onClick={() => setEditModal(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleUpdateSpace}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {role === 'Admin' && (
                    <div className="form-group">
                      <label className="form-label">Space Type *</label>
                      <select 
                        className="form-input" 
                        value={formData.type} 
                        onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}
                        style={{ background: '#FFF' }}
                      >
                        <option value="Department">Department</option>
                        <option value="Contract">Contract</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Space Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.spaceName}
                      onChange={e => setFormData(p => ({ ...p, spaceName: e.target.value }))}
                      required
                    />
                  </div>

                  {formData.type === 'Contract' && role === 'Admin' && (
                    <div className="form-group">
                      <label className="form-label">Contract End Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.endDate}
                        onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                        required
                      />
                    </div>
                  )}

                  {role === 'Admin' && (
                    <div className="form-group">
                      <label className="form-label">Workforce Capacity Limit *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.numberOfEmployees}
                        onChange={e => setFormData(p => ({ ...p, numberOfEmployees: e.target.value }))}
                        required
                      />
                      <span className="form-hint">Maximum number of employees allowed in this segment.</span>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>Working Days *</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {DAYS_OF_WEEK.map(day => {
                        const isSelected = (formData.workingDays || []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleWorkingDay(day)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600',
                              border: isSelected ? '1px solid var(--primary-500)' : '1px solid var(--gray-200)',
                              background: isSelected ? 'var(--primary-50)' : '#FFF',
                              color: isSelected ? 'var(--primary-700)' : 'var(--gray-600)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              outline: 'none'
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <span className="form-hint" style={{ marginTop: 4, display: 'block' }}>Select the weekly working days for attendance and penalty calculations.</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Shift Start Time *</label>
                      <input
                        type="time"
                        step="1"
                        className="form-input"
                        value={formData.workStartTime}
                        onChange={e => setFormData(p => ({ ...p, workStartTime: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Shift End Time *</label>
                      <input
                        type="time"
                        step="1"
                        className="form-input"
                        value={formData.workEndTime}
                        onChange={e => setFormData(p => ({ ...p, workEndTime: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Daily Breaks *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.numberOfBreaks}
                        onChange={e => setFormData(p => ({ ...p, numberOfBreaks: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Break Duration (m) *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.breakTime}
                        onChange={e => setFormData(p => ({ ...p, breakTime: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Shift Duration (h) *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.workingHours}
                        onChange={e => setFormData(p => ({ ...p, workingHours: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* ─── Leave Policy (Edit) ───────────────────────── */}
                <div style={{ padding: '0 20px 4px' }}>
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)',
                    border: '1px solid #FCD34D',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#B45309' }}>event_busy</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Leave Policy — Monthly Limits</span>
                      {leaveConfigLoading && <span style={{ fontSize: 11, color: '#B45309', marginLeft: 'auto' }}>Loading...</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>🚨 Emergency / Month</label>
                        <input
                          type="number" min="0" max="30"
                          className="form-input"
                          value={leaveConfig.emergencyLeavesPerMonth}
                          onChange={e => setLeaveConfig(p => ({ ...p, emergencyLeavesPerMonth: e.target.value }))}
                          disabled={leaveConfigLoading}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>🎓 College / Month</label>
                        <input
                          type="number" min="0" max="30"
                          className="form-input"
                          value={leaveConfig.collegeLeavesPerMonth}
                          onChange={e => setLeaveConfig(p => ({ ...p, collegeLeavesPerMonth: e.target.value }))}
                          disabled={leaveConfigLoading}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#92400E', marginTop: 6 }}>
                      Normal leaves are unlimited. Emergency &amp; College are capped per month.
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== CONTRACT PAYOUT & PAYSLIPS MODAL ==================== */}
        {payoutModal && selectedSpace && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal" style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Contract Payment Console</h3>
                <button className="icon-btn" onClick={() => setPayoutModal(false)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Contract Status Card */}
                <div style={{
                  padding: 16,
                  borderRadius: 12,
                  background: contractPaymentInfo?.status === 'Paid' ? '#ECFDF5' : '#FFFBEB',
                  border: contractPaymentInfo?.status === 'Paid' ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: 28,
                    color: contractPaymentInfo?.status === 'Paid' ? '#059669' : '#D97706'
                  }}>
                    {contractPaymentInfo?.status === 'Paid' ? 'check_circle' : 'pending_actions'}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600 }}>PAYMENT STATUS</div>
                    <strong style={{ fontSize: 15, color: contractPaymentInfo?.status === 'Paid' ? '#065F46' : '#92400E' }}>
                      {contractPaymentInfo?.status === 'Paid' ? 'PAYMENT FULLY PROCESSED' : 'OUTSTANDING SETTLEMENT'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Contract Title:</div>
                  <strong style={{ fontSize: 16, color: 'var(--gray-900)' }}>{selectedSpace.spaceName || selectedSpace.SpaceName}</strong>
                </div>

                {contractPaymentInfo?.status === 'Paid' ? (
                  /* Paid state details */
                  <div style={{ background: '#F9FAFB', padding: 16, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--gray-500)' }}>Amount Settled:</span>
                      <strong style={{ color: 'var(--gray-800)' }}>₹{contractPaymentInfo.amount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--gray-500)' }}>Method:</span>
                      <strong style={{ color: 'var(--gray-800)' }}>{contractPaymentInfo.paymentMethod}</strong>
                    </div>
                    {contractPaymentInfo.transactionId && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--gray-500)' }}>Txn ID:</span>
                        <strong style={{ color: 'var(--gray-800)' }}>{contractPaymentInfo.transactionId}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--gray-500)' }}>Settled At:</span>
                      <strong style={{ color: 'var(--gray-800)' }}>
                        {contractPaymentInfo.paidAt ? new Date(contractPaymentInfo.paidAt).toLocaleString() : 'N/A'}
                      </strong>
                    </div>
                  </div>
                ) : (
                  /* Checkout Forms */
                  <form onSubmit={handleProcessPayout} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Total Contract Payout Amount (₹) *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={payoutData.amount}
                        onChange={e => setPayoutData(p => ({ ...p, amount: e.target.value }))}
                        required
                      />
                      <span className="form-hint">This total amount will be divided equally and sent as batch payslips.</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Payment Method *</label>
                        <select
                          className="form-input"
                          value={payoutData.paymentMethod}
                          onChange={e => setPayoutData(p => ({ ...p, paymentMethod: e.target.value }))}
                          style={{ background: '#FFF' }}
                        >
                          <option value="UPI">UPI Transfer</option>
                          <option value="Razorpay">Razorpay Checkout</option>
                          <option value="Cash">Cash Handout</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Transaction Reference ID *</label>
                        <input
                          type="text"
                          className="form-input"
                          value={payoutData.transactionId}
                          onChange={e => setPayoutData(p => ({ ...p, transactionId: e.target.value }))}
                          placeholder="e.g. txn_987483782928"
                          required={payoutData.paymentMethod !== 'Cash'}
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ marginTop: 6, justifyContent: 'center', background: '#7C3AED' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>payments</span>
                      Release Funds & Generate Batch Payslips
                    </button>
                  </form>
                )}

                {/* Generated Payslips Breakdown */}
                <div style={{ marginTop: 10 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--gray-800)' }}>
                    Generated Roster Payslips ({contractPayslips.length})
                  </h4>
                  {contractPayslips.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)', background: 'var(--gray-50)', borderRadius: 8, fontSize: 12 }}>
                      No payslips generated for this contract yet. Release payout to trigger batch payslips.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {contractPayslips.map(slip => (
                        <div key={slip.slipId || slip.SlipId} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: '#FFF',
                          border: '1px solid var(--gray-100)',
                          borderRadius: 8,
                          fontSize: 13
                        }}>
                          <div>
                            <strong style={{ color: 'var(--gray-900)' }}>{slip.name || slip.Name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{slip.email || slip.Email}</div>
                          </div>
                          <strong style={{ color: '#10B981', fontSize: 14 }}>
                            +₹{slip.finalAmount || slip.FinalAmount}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setPayoutModal(false)} style={{ width: '100%', justifyContent: 'center' }}>
                  Close Console
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
