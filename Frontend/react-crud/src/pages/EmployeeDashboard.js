import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { attendanceApi } from '../api/attendance';
// import { payrollApi } from '../api/payroll';
import { projectsApi } from '../api/projects';
import { leavesApi } from '../api/leaves';
import { DashboardStatsSkeleton } from '../components/Skeletons';
import toast from 'react-hot-toast';
import { noticesApi } from '../api';
import { analyticsApi } from '../api/analytics';
import { worklogsApi } from '../api/worklogs';

const CLOCK_COOLDOWN_MS = 2000;

function StatCard({ icon, iconBg, iconColor, label, value, sub, badge, badgeColor }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-card-icon" style={{ background: iconBg }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: iconColor }}>{icon}</span>
        </div>
        {badge && <span className="badge" style={{ background: badgeColor + '20', color: badgeColor }}>{badge}</span>}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-900)' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function WorkingLogsChart({ data, loading, range }) {
  const [visibleCategories, setVisibleCategories] = useState({
    beforeBreak: true,
    break: true,
    afterBreak: true,
    missing: true,
  });

  const [hoveredIndex, setHoveredIndex] = useState(null);

  const categories = [
    { key: 'beforeBreak', label: 'Before Break', color: '#10B981' },
    { key: 'break', label: 'Break', color: '#F59E0B' },
    { key: 'afterBreak', label: 'After Break', color: '#047857' },
    { key: 'missing', label: 'Missing', color: '#EF4444' },
  ];

  const maxSum = useMemo(() => {
    if (!data || data.length === 0) return 8;
    const sums = data.map(d => {
      let sum = 0;
      if (visibleCategories.beforeBreak) sum += Number(d.beforeBreak || 0);
      if (visibleCategories.break) sum += Number(d.break || 0);
      if (visibleCategories.afterBreak) sum += Number(d.afterBreak || 0);
      if (visibleCategories.missing) sum += Number(d.missing || 0);
      return sum;
    });
    return Math.max(...sums, 8);
  }, [data, visibleCategories]);

  const toggleCategory = (key) => {
    setVisibleCategories(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 210 }}>
        <div className="spinner" style={{ width: 30, height: 30 }} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 210, color: 'var(--gray-400)', fontSize: 13 }}>
        No working log data available.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {categories.map(cat => {
          const isVisible = visibleCategories[cat.key];
          return (
            <div
              key={cat.key}
              onClick={() => toggleCategory(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                opacity: isVisible ? 1 : 0.4,
                textDecoration: isVisible ? 'none' : 'line-through',
                userSelect: 'none',
                transition: 'opacity 0.2s',
              }}
            >
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
              <span style={{ color: 'var(--gray-600)' }}>{cat.label}</span>
            </div>
          );
        })}
      </div>

      {/* Chart Bars */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 160,
        gap: range === 'weekly' ? 12 : range === '6months' ? 16 : 3,
        padding: '10px 0 0 0',
        position: 'relative',
      }}>
        {data.map((d, idx) => {
          const valBeforeBreak = visibleCategories.beforeBreak ? Number(d.beforeBreak || 0) : 0;
          const valBreak = visibleCategories.break ? Number(d.break || 0) : 0;
          const valAfterBreak = visibleCategories.afterBreak ? Number(d.afterBreak || 0) : 0;
          const valMissing = visibleCategories.missing ? Number(d.missing || 0) : 0;

          const total = valBeforeBreak + valBreak + valAfterBreak + valMissing;
          const pctBefore = maxSum > 0 ? (valBeforeBreak / maxSum) * 100 : 0;
          const pctBreak = maxSum > 0 ? (valBreak / maxSum) * 100 : 0;
          const pctAfter = maxSum > 0 ? (valAfterBreak / maxSum) * 100 : 0;
          const pctMissing = maxSum > 0 ? (valMissing / maxSum) * 100 : 0;

          const hasAnyValue = (d.beforeBreak || d.break || d.afterBreak || d.missing) > 0;
          const showLabel = range !== 'monthly' || idx === 0 || idx === data.length - 1 || (idx + 1) % 5 === 0;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                position: 'relative',
              }}
            >
              {/* Stack container */}
              <div style={{
                width: '100%',
                height: `${(total / maxSum) * 100}%`,
                minHeight: hasAnyValue ? '3px' : '0px',
                display: 'flex',
                flexDirection: 'column-reverse',
                borderRadius: '3px',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                transform: hoveredIndex === idx ? 'scaleX(1.2) translateY(-2px)' : 'none',
                boxShadow: hoveredIndex === idx ? '0 4px 10px rgba(0,0,0,0.15)' : 'none',
                background: 'transparent',
              }}>
                {pctBefore > 0 && <div style={{ height: `${(pctBefore / (total || 1)) * 100}%`, background: '#10B981', transition: 'height 0.3s' }} />}
                {pctBreak > 0 && <div style={{ height: `${(pctBreak / (total || 1)) * 100}%`, background: '#F59E0B', transition: 'height 0.3s' }} />}
                {pctAfter > 0 && <div style={{ height: `${(pctAfter / (total || 1)) * 100}%`, background: '#047857', transition: 'height 0.3s' }} />}
                {pctMissing > 0 && <div style={{ height: `${(pctMissing / (total || 1)) * 100}%`, background: '#EF4444', transition: 'height 0.3s' }} />}
              </div>

              {/* X-Axis Label */}
              <div style={{
                textAlign: 'center',
                fontSize: '9px',
                fontWeight: 600,
                color: 'var(--gray-500)',
                marginTop: 4,
                whiteSpace: 'nowrap',
                opacity: showLabel ? 1 : 0,
              }}>
                {d.label}
              </div>

              {/* Tooltip */}
              {hoveredIndex === idx && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%) translateY(-8px)',
                  background: 'rgba(15, 23, 42, 0.95)',
                  color: '#fff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  boxShadow: '0 8px 12px -3px rgba(0,0,0,0.3), 0 3px 5px -2px rgba(0,0,0,0.15)',
                  zIndex: 999,
                  pointerEvents: 'none',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  minWidth: '140px',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 5, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 3 }}>
                    {range === 'weekly' ? `Day: ${d.label}` : range === 'monthly' ? `Date: ${d.label}` : `Month: ${d.label}`}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                        Before Break:
                      </span>
                      <strong>{Number(d.beforeBreak).toFixed(1)}h</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
                        Break:
                      </span>
                      <strong>{Number(d.break).toFixed(1)}h</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#047857' }} />
                        After Break:
                      </span>
                      <strong>{Number(d.afterBreak).toFixed(1)}h</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
                        Missing:
                      </span>
                      <strong style={{ color: '#FCA5A5' }}>{Number(d.missing).toFixed(1)}h</strong>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 6,
                    paddingTop: 4,
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                  }}>
                    <span>Worked:</span>
                    <span>{(Number(d.beforeBreak) + Number(d.afterBreak)).toFixed(1)}h</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_STYLE = {
  Open: 'badge-error',
  InProgress: 'badge-warning',
  'In Progress': 'badge-warning',
  Solved: 'badge-success',
};

const parseNoticeText = (text) => {
  if (!text) return { title: 'Query', description: '' };
  const colonIndex = text.indexOf(': ');
  if (colonIndex > -1) {
    return {
      title: text.substring(0, colonIndex),
      description: text.substring(colonIndex + 2)
    };
  }
  return { title: 'Query Topic', description: text };
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'Employee';
  const isTL = role === 'TeamLead';
  const isManager = role === 'Manager';
  const [attendance, setAttendance] = useState([]);
  const [dateOfJoining, setDateOfJoining] = useState(null);
  const [spaceWorkingDays, setSpaceWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [queries, setQueries] = useState([]);
  const [loading] = useState(false);
  const [clockStatus, setClockStatus] = useState('idle');
  const [lastSync, setLastSync] = useState(null);
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [myProjectsCount, setMyProjectsCount] = useState(null);

  // Analytics States
  const [productivityData, setProductivityData] = useState(null);
  const [performance, setPerformance] = useState(null);

  // Break and Timer States
  const [onBreak, setOnBreak] = useState(false);
  const [workingTime, setWorkingTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [loadingBreak, setLoadingBreak] = useState(true);

  const timerRef = useRef(null);

  // const [salary, setSalary] = useState(null);

  // Leave states
  const [myLeaves, setMyLeaves] = useState([]);

  // Working Logs States
  const [worklogRange, setWorklogRange] = useState('monthly');
  const [worklogChartData, setWorklogChartData] = useState([]);
  const [worklogLoading, setWorklogLoading] = useState(false);


  useEffect(() => {
    if (user?.empId) {
      setWorklogLoading(true);
      worklogsApi.getWorklogsChart(worklogRange)
        .then(r => {
          setWorklogChartData(r.data || []);
        })
        .catch(() => {
          console.warn("Failed to load working logs chart data silently.");
        })
        .finally(() => {
          setWorklogLoading(false);
        });

    }
  }, [user?.empId, worklogRange]);

  // const getDynamicSalary = (role) => {
  //   let basic = 25000, hra = 10000, da = 3000;
  //   if (role === 'Admin') { basic = 65000; hra = 25000; da = 10000; }
  //   else if (role === 'Manager') { basic = 45000; hra = 18000; da = 7000; }
  //   else if (role === 'TeamLead') { basic = 35000; hra = 15000; da = 5000; }
  //   const totalEarnings = basic + hra + da;
  //   const pf = Math.round(basic * 0.12);
  //   const tax = Math.round(totalEarnings * 0.08);
  //   return { basic, hra, da, totalEarnings, pf, tax, totalDeductions: pf + tax, netPay: totalEarnings - pf - tax };
  // };

  // const s = salary ? {
  //   basic: Number(salary.basic),
  //   hra: Number(salary.hra),
  //   da: Number(salary.da),
  //   totalEarnings: Number(salary.gross),
  //   netPay: Number(salary.net),
  // } : getDynamicSalary(user?.role || 'Employee');

  const fetchQueries = () => {
    noticesApi.getQueries()
      .then(r => {
        setQueries(r.data || []);
      })
      .catch(() => { });
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  const loadAttendance = async () => {
    try {
      const r = await attendanceApi.getMyAttendance();
      const data = r.data || {};
      setAttendance(Array.isArray(data.attendance) ? data.attendance : Array.isArray(data) ? data : []);
      if (data.dateOfJoining) setDateOfJoining(new Date(data.dateOfJoining));
      if (Array.isArray(data.workingDays) && data.workingDays.length > 0) setSpaceWorkingDays(data.workingDays);
    } catch (err) {
      console.error("Failed to load attendance", err);
    }
  };

  const loadActiveBreak = async () => {
    try {
      const res = await attendanceApi.getActiveBreak();
      console.log(res.data);

      if (res.data.isOnBreak) {
        setOnBreak(true);
        setBreakStartTime(new Date(res.data.breakStart));
      } else {
        setOnBreak(false);
        setBreakStartTime(null);
      }
    } catch (err) {
      console.error("Active break error", err);
    } finally {
      setLoadingBreak(false);
    }
  };

  useEffect(() => {
    loadAttendance();
    loadActiveBreak();
  }, []);

  useEffect(() => {
    // Load Analytics
    if (user?.empId) {
      analyticsApi.getProductivity().then(r => setProductivityData(r.data)).catch(() => { });
      analyticsApi.getPerformanceGrade().then(r => setPerformance(r.data)).catch(() => { });
    }

    // TL: load their project count
    if (isTL) {
      projectsApi.getMyProjects()
        .then(r => setMyProjectsCount((r.data || []).length))
        .catch(() => { });
    }

    // Load leave data
    leavesApi.getMyLeaves()
      .then(r => setMyLeaves(r.data || []))
      .catch(() => { });

    return () => clearTimeout(timerRef.current);
  }, [user?.empId, isTL]);

  const { presentDays, absentDays, lateDays } = useMemo(() => {
    // Map day number to short name for comparison with space's working days
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Only count attendance records for the current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthAttendance = attendance.filter(a => {
      const d = new Date(a.attendanceDate || a.attendancedate || a.clockIn);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const thisMonthPresentAttendance = thisMonthAttendance.filter(a => {
      const d = new Date(a.attendanceDate || a.attendancedate || a.clockIn);
      const dayName = dayMap[d.getDay()];
      const isWorkingDay = spaceWorkingDays.some(wd => wd.toLowerCase() === dayName.toLowerCase());
      const status = a.status || a.Status || '';
      return isWorkingDay && status.toLowerCase() !== 'absent';
    });

    const present = thisMonthPresentAttendance.length;
    const late = thisMonthPresentAttendance.filter(a => (a.lateMinutes || a.lateminutes || 0) > 0).length;
    const earlyExit = thisMonthPresentAttendance.filter(a => (a.earlyExitMinutes || a.earlyexitminutes || 0) > 0).length;

    // Calculate total working days for this month (from DOJ or month start to today)
    let totalWorkdays = 0;
    const monthStart = new Date(currentYear, currentMonth, 1);
    monthStart.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    let start = new Date(monthStart);
    // If employee joined this month, start counting from their DOJ
    if (dateOfJoining) {
      const doj = new Date(dateOfJoining); doj.setHours(0, 0, 0, 0);
      if (doj > start) start = doj;
    }

    const d = new Date(start);
    while (d <= today) {
      const dayName = dayMap[d.getDay()];
      if (spaceWorkingDays.some(wd => wd.toLowerCase() === dayName.toLowerCase())) {
        totalWorkdays++;
      }
      d.setDate(d.getDate() + 1);
    }

    // Filter approved leaves for current month
    const approvedLeavesCount = myLeaves.filter(l => {
      const status = l.status || l.Status || '';
      if (status.toLowerCase() !== 'approved') return false;
      const ld = new Date(l.leaveDate || l.leavedate);
      return ld.getMonth() === currentMonth && ld.getFullYear() === currentYear;
    }).length;

    const absent = Math.max(0, totalWorkdays - present - approvedLeavesCount);

    return { presentDays: present, absentDays: absent, lateDays: late, earlyExitDays: earlyExit };
  }, [attendance, dateOfJoining, spaceWorkingDays, myLeaves]);

  const todayRecord = attendance.find(a => {
    const d = new Date(a.attendanceDate || a.attendancedate || a.clockIn);
    return d.toDateString() === new Date().toDateString();
  });
  const isClockedIn = !!todayRecord?.clockIn && !todayRecord?.clockOut;

  // Active timers for real-time tracking
  useEffect(() => {
    let interval = null;
    if (isClockedIn) {
      const clockInTime = new Date(todayRecord.clockIn).getTime();
      const initialSeconds = Math.max(0, Math.floor((Date.now() - clockInTime) / 1000));
      setWorkingTime(initialSeconds);

      interval = setInterval(() => {
        if (!onBreak) {
          setWorkingTime(prev => prev + 1);
        }
      }, 1000);
    } else if (todayRecord?.clockIn && todayRecord?.clockOut) {
      const clockIn = new Date(todayRecord.clockIn).getTime();
      const clockOut = new Date(todayRecord.clockOut).getTime();
      setWorkingTime(Math.max(0, Math.floor((clockOut - clockIn) / 1000)));
    } else {
      setWorkingTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isClockedIn, onBreak, todayRecord]);

  // Fix timer for break time
  useEffect(() => {
    const interval = setInterval(() => {
      if (onBreak && breakStartTime) {
        const diff = Date.now() - breakStartTime.getTime();
        setBreakTime(Math.floor(diff / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onBreak, breakStartTime]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleBreakStart = async () => {
    try {
      await attendanceApi.breakStart();
      const now = new Date();
      setOnBreak(true);
      setBreakStartTime(now);
      setBreakTime(0);
      toast.success('☕ Break started! Working timer paused.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to start break.';
      toast.error(msg);
    }
  };

  const handleBreakEnd = async () => {
    try {
      await attendanceApi.breakEnd();
      setOnBreak(false);
      setBreakStartTime(null);
      setBreakTime(0);
      toast.success('▶️ Break ended! Working timer resumed.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to end break.';
      toast.error(msg);
    }
  };

  const handleClock = useCallback(async (type) => {
    if (btnDisabled) return;

    // Haptic feedback on mobile
    if ('vibrate' in navigator) navigator.vibrate(50);

    // Disable button for cooldown
    setBtnDisabled(true);
    timerRef.current = setTimeout(() => setBtnDisabled(false), CLOCK_COOLDOWN_MS);

    // Optimistic UI update
    const optimisticRecord = {
      attendanceId: Date.now(), attendanceDate: new Date().toISOString(),
      clockIn: type === 'in' ? new Date().toISOString() : todayRecord?.clockIn,
      clockOut: type === 'out' ? new Date().toISOString() : null,
      status: 'Present', lateMinutes: 0, earlyExitMinutes: 0,
    };
    setAttendance(prev => {
      const filtered = prev.filter(a => a.attendanceId !== (todayRecord?.attendanceId));
      return [...filtered, optimisticRecord];
    });
    setClockStatus('syncing');

    try {
      if (type === 'in') {
        await attendanceApi.clockIn();
        window.dispatchEvent(new Event('clock-in-event'));
      } else {
        await attendanceApi.clockOut();
        window.dispatchEvent(new Event('clock-out-event'));
      }

      setClockStatus('success');
      setLastSync(new Date());
      toast.success(type === 'in' ? '✅ Clocked in!' : '✅ Clocked out!');

      // Refresh data
      const r = await attendanceApi.getMyAttendance();
      const data = r.data || {};
      setAttendance(Array.isArray(data.attendance) ? data.attendance : Array.isArray(data) ? data : []);
    } catch (err) {
      // Revert optimistic update
      setAttendance(prev => prev.filter(a => a.attendanceId !== optimisticRecord.attendanceId));
      setClockStatus('error');
      const msg = err.response?.data?.message || 'Failed to record attendance.';
      toast.error(msg, {
        duration: 8000,
        action: { label: 'Retry', onClick: () => handleClock(type) },
      });
    } finally {
      setTimeout(() => setClockStatus('idle'), 3000);
    }
  }, [btnDisabled, todayRecord]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getRoleTitle = () => {
    if (isTL) return 'Team Lead';
    if (isManager) return 'Manager';
    return '';
  };

  const getPerformanceColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return 'var(--success)';
    if (grade === 'B') return 'var(--primary-500)';
    if (grade === 'C') return 'var(--warning)';
    return 'var(--danger)';
  };

  if (loadingBreak) return null;

  return (
    <AppLayout role="employee">
      <div className="page-content fade-in">
        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
              {greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            {(isTL || isManager) && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                background: isTL ? '#FEF3C7' : '#DBEAFE',
                color: isTL ? '#92400E' : '#1D4ED8',
              }}>
                {getRoleTitle()}
              </span>
            )}
            {performance && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
                background: getPerformanceColor(performance.grade) + '20',
                color: getPerformanceColor(performance.grade),
              }}>
                Grade: {performance.grade}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Clock In/Out Card */}
        <div className="clock-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, opacity: .7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                Today's Attendance
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.02em' }}>
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ fontSize: 13, opacity: .75, marginTop: 4 }}>
                {isClockedIn ? '🟢 Currently working' : '⚪ Not clocked in'}
                {lastSync && <span style={{ marginLeft: 12, fontSize: 11, opacity: .6 }}>Synced {Math.round((Date.now() - lastSync) / 1000)}s ago</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {clockStatus === 'syncing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: .8 }}>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Syncing...
                </div>
              )}
              <button
                className="btn btn-success"
                onClick={() => handleClock('in')}
                disabled={btnDisabled || isClockedIn}
                aria-label="Clock In"
                style={{ background: isClockedIn ? 'rgba(255,255,255,.2)' : undefined }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>
                Clock In
              </button>

              {isClockedIn && (
                <>
                  {onBreak ? (
                    <button
                      className="btn"
                      onClick={handleBreakEnd}
                      style={{ background: 'var(--primary-500)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
                      End Break
                    </button>
                  ) : (
                    <button
                      className="btn"
                      onClick={handleBreakStart}
                      style={{ background: 'var(--warning-500)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>coffee</span>
                      Start Break
                    </button>
                  )}
                </>
              )}

              <button
                className="btn btn-danger"
                onClick={() => handleClock('out')}
                disabled={btnDisabled || !isClockedIn || onBreak}
                aria-label="Clock Out"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                Clock Out
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.15)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, opacity: .6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Clock In</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{todayRecord?.clockIn ? new Date(todayRecord.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: .6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Clock Out</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{todayRecord?.clockOut ? new Date(todayRecord.clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: .6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Working Time</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: onBreak ? 'var(--gray-500)' : 'var(--success-600)' }}>{formatTime(workingTime)}</div>
            </div>
            {isClockedIn && (
              <div>
                <div style={{ fontSize: 11, opacity: .6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Break Time</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: onBreak ? 'var(--warning-600)' : 'var(--gray-500)' }}>{formatTime(breakTime)}</div>
              </div>
            )}
            {isTL && myProjectsCount !== null && (
              <div style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/projects')}>
                <div style={{ fontSize: 11, opacity: .6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Active Projects</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{myProjectsCount}</div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {loading ? <DashboardStatsSkeleton /> : (
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            <StatCard icon="check_circle" iconBg="#D1FAE5" iconColor="#059669" label="Present" value={presentDays} sub="this month" />
            <StatCard icon="cancel" iconBg="#FEE2E2" iconColor="#DC2626" label="Absent" value={absentDays} sub="this month" />
            <StatCard icon="schedule" iconBg="#FEF3C7" iconColor="#D97706" label="Late Arrivals" value={lateDays} sub="this month" />
            <div
              className="stat-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/employee/leaves')}
              title="View Leave Management"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-card-icon" style={{ background: '#FEF3C7' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#B45309' }}>event_busy</span>
                </div>
                {myLeaves.filter(l => (l.status ?? l.Status) === 'Pending').length > 0 && (
                  <span className="badge" style={{ background: '#FCD34D20', color: '#B45309' }}>
                    {myLeaves.filter(l => (l.status ?? l.Status) === 'Pending').length} pending
                  </span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Leaves</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gray-900)' }}>
                  {myLeaves.filter(l => (l.status ?? l.Status) === 'Approved').length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>approved this month</div>
              </div>
            </div>
          </div>
        )}

        {/* Productivity Score & Weekly Hours Row */}
        {productivityData && (
          <div className="grid grid-2" style={{ marginBottom: 24 }}>
            <div className="card" style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Productivity Score</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#0c4a6e', marginTop: 8 }}>
                {Number(productivityData.totalScore).toFixed(0)}<span style={{ fontSize: 24, opacity: 0.5 }}>/100</span>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 13 }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}><span>Attendance</span> <strong>{Number(productivityData.attendanceScore).toFixed(0)}%</strong></div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}><span>Work Hours</span> <strong>{Number(productivityData.worklogScore).toFixed(0)}%</strong></div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}><span>Task</span> <strong>{Number(productivityData.taskScore).toFixed(0)}%</strong></div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Working Hours (Week)</h3>
                <span className="badge badge-primary">Real-time</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>
                {Number(productivityData.totalHours).toFixed(0)}<span style={{ fontSize: 16, opacity: 0.6, fontWeight: 500 }}> / {Number(productivityData.expectedHours).toFixed(0)} hrs</span>
              </div>
              <div className="progress-bar" style={{ marginTop: 16, height: 10 }}>
                <div className="progress-fill" style={{ width: `${Math.min(productivityData.worklogScore, 100)}%`, background: 'var(--primary-500)' }} />
              </div>
            </div>
          </div>
        )}



        {/* Working Logs — Full Width */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Working Logs</h3>
            <div style={{ display: 'flex', gap: 4, background: 'var(--gray-100)', padding: 4, borderRadius: 8 }}>
              {['weekly', 'monthly', '6months'].map(v => (
                <button key={v} onClick={() => setWorklogRange(v)} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none',
                  background: worklogRange === v ? '#fff' : 'transparent',
                  color: worklogRange === v ? 'var(--primary-600)' : 'var(--gray-600)',
                  borderRadius: 6, cursor: 'pointer', boxShadow: worklogRange === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}>
                  {v === '6months' ? '6 Months' : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <WorkingLogsChart data={worklogChartData} loading={worklogLoading} range={worklogRange} />
        </div>


        {/* TL Quick Actions */}
        {isTL && (
          <div className="card" style={{ marginTop: 24, background: 'linear-gradient(135deg, #4F46E510, #7C3AED10)', border: '1px solid #4F46E530' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>🎯 Team Lead Quick Actions</h3>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/employee/projects')}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                Create / Manage Projects
                {myProjectsCount !== null && (
                  <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    {myProjectsCount} active
                  </span>
                )}
              </button>
              <button
                className="btn"
                onClick={() => navigate('/employee/all-employees')}
                style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>groups</span>
                View Team
              </button>
              <button
                className="btn"
                onClick={() => navigate('/employee/worklogs')}
                style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>schedule</span>
                Work Logs
              </button>
            </div>
          </div>
        )}

        {/* Manager readonly notice */}
        {isManager && (
          <div className="card" style={{ marginTop: 24, background: '#DBEAFE20', border: '1px solid #BFDBFE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ color: '#1D4ED8', fontSize: 20 }}>info</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1D4ED8' }}>Manager Access</div>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>You have read-only access to employee data and projects. Use the navigation to view team attendance, salary, and project progress.</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Queries */}
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Queries</h3>
          </div>
          {queries.length === 0 ? (
            <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>No recent queries found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {queries.slice(0, 3).map(q => {
                const { title } = parseNoticeText(q.noticeText);
                return (
                  <div key={q.noticeId} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{title}</span>
                    <span className={`badge ${STATUS_STYLE[q.status] || 'badge-gray'}`}>{q.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
