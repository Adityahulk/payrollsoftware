import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { attendanceApi } from '../api/attendance';
import { usersApi } from '../api/index';
import { worklogsApi } from '../api/worklogs';
import { CalendarSkeleton } from '../components/Skeletons';
import toast from 'react-hot-toast';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const STATUS_STYLE = {
  Present: { bg: '#D1FAE5', color: '#065F46', dot: '#10B981', label: 'Present' },
  Late: { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B', label: 'Late' },
  EarlyExit: { bg: '#F3E8FF', color: '#6B21A8', dot: '#9333EA', label: 'Early Exit' },
  Absent: { bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444', label: 'Absent' },
  Disabled: { bg: '#F3F4F6', color: '#D1D5DB', dot: '#E5E7EB', label: 'Disabled' },
  weekend: { bg: '#F9FAFB', color: '#9CA3AF', dot: '#D1D5DB', label: 'Off Day' },
  future: { bg: '#fff', color: '#D1D5DB', dot: 'transparent', label: 'Future' },
  today: { bg: '#EEF2FF', color: '#4338CA', dot: '#4F46E5', label: 'Today' },
  Holiday: { bg: '#E0F2FE', color: '#0369A1', dot: '#0284C7', label: 'Holiday' },
};

const LEGEND = [
  ['#10B981', 'Present'],
  ['#F59E0B', 'Late'],
  ['#9333EA', 'Early Exit'],
  ['#EF4444', 'Absent'],
  ['#D1D5DB', 'Disabled'],
  ['#9CA3AF', 'Off Day'],
  ['#0284C7', 'Holiday'],
];

const toDateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #D1D5DB',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  background: '#fff',
};

export default function AttendancePage({ isAdmin }) {
  const { user } = useAuth();
  // Shared state
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState({ month: today.getMonth(), year: today.getFullYear() });
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [dailyActivities, setDailyActivities] = useState([]);
  const [selectedEmpActivities, setSelectedEmpActivities] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // Sidebar widget tabs
  const [rightTab, setRightTab] = useState('rollcall');
  const [rollCallTab, setRollCallTab] = useState('present');
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'National Holiday' });
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Employee-only state
  const [records, setRecords] = useState([]);
  const [dateOfJoining, setDateOfJoining] = useState(null);
  const [clocking, setClocking] = useState(false);
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  // Admin-only state
  const [allUsers, setAllUsers] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [selectedEmpAttendance, setSelectedEmpAttendance] = useState([]);
  const [selectedEmpDoj, setSelectedEmpDoj] = useState(null);
  const [selectedEmpWorkingDays, setSelectedEmpWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [loadingSelectedEmp, setLoadingSelectedEmp] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [selectSearch, setSelectSearch] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch space holidays
      try {
        const holRes = await attendanceApi.getHolidays();
        setHolidays(holRes.data || []);
      } catch (e) {
        console.warn('Failed to load holidays silently', e);
      }

      if (isAdmin) {
        const [usersRes, attRes] = await Promise.all([
          usersApi.getCompanyUsers(),   // /api/User/company — accessible to all roles (Admin, Manager, TL)
          attendanceApi.getAllAttendance(),
        ]);
        let usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        let attData = Array.isArray(attRes.data) ? attRes.data : [];

        if (user?.role !== 'Admin') {
          const mySpaceId = user?.spaceId || user?.SpaceId;
          if (mySpaceId !== undefined && mySpaceId !== null) {
            usersData = usersData.filter(u => u.spaceId === mySpaceId || u.spaceid === mySpaceId);
            const userIdsInSpace = new Set(usersData.map(u => Number(u.empId || u.id)));
            attData = attData.filter(a => userIdsInSpace.has(Number(a.empId || a.empid)));
          }
        }

        setAllUsers(usersData);
        setAllAttendance(attData);

        const employees = usersData.filter(u => (u.role || '').toLowerCase() !== 'superadmin');
        if (employees.length > 0) {
          const ownId = user?.empId || user?.id;
          const hasOwn = employees.some(e => Number(e.empId || e.id) === Number(ownId));
          setSelectedEmpId(hasOwn ? ownId : (employees[0].empId || employees[0].id));
        }
      } else {
        const [attRes, actRes] = await Promise.all([
          attendanceApi.getMyAttendance(),
          worklogsApi.getMyDailyActivity('monthly')
        ]);
        const data = attRes.data || {};
        setRecords(Array.isArray(data.attendance) ? data.attendance : Array.isArray(data) ? data : []);
        if (data.dateOfJoining) setDateOfJoining(new Date(data.dateOfJoining));
        if (data.workingDays) setWorkingDays(data.workingDays);
        setDailyActivities(actRes.data || []);
      }
    } catch (err) {
      console.warn(isAdmin ? 'Failed to load company attendance data silently' : 'Failed to load attendance data silently', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Load selected employee attendance records (Admin only)
  useEffect(() => {
    if (!isAdmin || !selectedEmpId) return;

    const fetchEmpAttendance = async () => {
      setLoadingSelectedEmp(true);
      try {
        const [res, actRes] = await Promise.all([
          attendanceApi.getUserAttendance(selectedEmpId),
          worklogsApi.getDailyActivityByEmpId(selectedEmpId, 'monthly')
        ]);
        const data = res.data || {};
        const recs = Array.isArray(data.attendance) ? data.attendance : Array.isArray(data) ? data : [];
        setSelectedEmpAttendance(recs);
        setSelectedEmpActivities(actRes.data || []);
        if (data.workingDays) {
          setSelectedEmpWorkingDays(data.workingDays);
        } else {
          setSelectedEmpWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        }

        const empUser = allUsers.find(u => Number(u.empId || u.id) === Number(selectedEmpId));
        if (empUser) {
          const dojVal = empUser.dateOfJoining || empUser.dateofjoining;
          setSelectedEmpDoj(dojVal ? new Date(dojVal) : null);
        } else {
          setSelectedEmpDoj(null);
        }
      } catch (err) {
        console.warn('Failed to load employee attendance records silently', err);
      } finally {
        setLoadingSelectedEmp(false);
      }
    };

    fetchEmpAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpId, allUsers, isAdmin]);

  // Sync search selector text with selected employee name
  const employees = useMemo(() => {
    return allUsers.filter(u => (u.role || '').toLowerCase() !== 'superadmin');
  }, [allUsers]);

  const activeEmployee = useMemo(() => {
    return employees.find(emp => Number(emp.empId || emp.id) === Number(selectedEmpId));
  }, [employees, selectedEmpId]);

  useEffect(() => {
    if (activeEmployee) {
      setSelectSearch(activeEmployee.name || activeEmployee.email || '');
    }
  }, [selectedEmpId, activeEmployee]);

  // Employee-only calculations
  const recordMap = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const key = toDateKey(r.attendanceDate || r.attendancedate || r.clockIn);
      map[key] = r;
    });
    return map;
  }, [records]);

  const stats = useMemo(() => {
    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const presentRecords = records.filter(r => {
      const d = new Date(r.attendanceDate || r.attendancedate || r.clockIn);
      const dayName = DAYS_SHORT[d.getDay()];
      const isWorking = workingDays.some(w => w.toLowerCase() === dayName.toLowerCase());
      const status = r.status || r.Status || '';
      return isWorking && status.toLowerCase() !== 'absent';
    });

    const presentCount = presentRecords.length;
    const lateCount = presentRecords.filter(r => (r.lateMinutes || r.lateminutes || 0) > 0).length;
    const earlyExitCount = presentRecords.filter(r => (r.earlyExitMinutes || r.earlyexitminutes || 0) > 0).length;

    let totalDays = 0;
    let absentCount = 0;
    if (dateOfJoining) {
      const start = new Date(dateOfJoining);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const d = new Date(start);
      while (d <= end) {
        const dow = d.getDay();
        const dayName = DAYS_SHORT[dow];
        const isWorking = workingDays.some(w => w.toLowerCase() === dayName.toLowerCase());
        if (isWorking) {
          totalDays++;
          const dateKey = toDateKey(d);
          const rec = recordMap[dateKey];
          if (!rec || (rec.status || rec.Status || '').toLowerCase() === 'absent') {
            absentCount++;
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return { presentCount, absentCount, lateCount, earlyExitCount, totalDays };
  }, [records, dateOfJoining, workingDays, recordMap]);

  // Admin-only calculations
  const selectedRecordMap = useMemo(() => {
    const map = {};
    selectedEmpAttendance.forEach(r => {
      const key = toDateKey(r.attendanceDate || r.attendancedate || r.clockIn || r.clockin);
      map[key] = r;
    });
    return map;
  }, [selectedEmpAttendance]);

  const selectedStats = useMemo(() => {
    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const presentRecords = selectedEmpAttendance.filter(r => {
      const d = new Date(r.attendanceDate || r.attendancedate || r.clockIn || r.clockin);
      const dayName = DAYS_SHORT[d.getDay()];
      const isWorking = selectedEmpWorkingDays.some(w => w.toLowerCase() === dayName.toLowerCase());
      const status = r.status || r.Status || '';
      return isWorking && status.toLowerCase() !== 'absent';
    });

    const presentCount = presentRecords.length;
    const lateCount = presentRecords.filter(r => (r.lateMinutes || r.lateminutes || 0) > 0).length;
    const earlyExitCount = presentRecords.filter(r => (r.earlyExitMinutes || r.earlyexitminutes || 0) > 0).length;

    let totalDays = 0;
    let absentCount = 0;
    if (selectedEmpDoj) {
      const start = new Date(selectedEmpDoj);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const d = new Date(start);
      while (d <= end) {
        const dow = d.getDay();
        const dayName = DAYS_SHORT[dow];
        const isWorking = selectedEmpWorkingDays.some(w => w.toLowerCase() === dayName.toLowerCase());
        if (isWorking) {
          totalDays++;
          const dateKey = toDateKey(d);
          const rec = selectedRecordMap[dateKey];
          if (!rec || (rec.status || rec.Status || '').toLowerCase() === 'absent') {
            absentCount++;
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return { presentCount, absentCount, lateCount, earlyExitCount, totalDays };
  }, [selectedEmpAttendance, selectedEmpDoj, selectedEmpWorkingDays, selectedRecordMap]);

  // Split employees for today's lists
  const presentTodayRecords = useMemo(() => {
    return allAttendance.filter(a => {
      const clockInVal = a.clockIn || a.clockin;
      if (!clockInVal) return false;
      return new Date(clockInVal).toDateString() === new Date().toDateString();
    });
  }, [allAttendance]);

  const presentEmpIds = useMemo(() => {
    return new Set(presentTodayRecords.map(a => Number(a.empId || a.empid)));
  }, [presentTodayRecords]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp =>
      (emp.name || '').toLowerCase().includes(listSearch.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(listSearch.toLowerCase())
    );
  }, [employees, listSearch]);

  const presentTodayList = useMemo(() => {
    return filteredEmployees.filter(emp => presentEmpIds.has(Number(emp.empId || emp.id)));
  }, [filteredEmployees, presentEmpIds]);

  const absentTodayList = useMemo(() => {
    return filteredEmployees.filter(emp => !presentEmpIds.has(Number(emp.empId || emp.id)));
  }, [filteredEmployees, presentEmpIds]);

  // Clock actions (Employee only)
  const handleClock = async (type) => {
    if (clocking) return;
    if ('vibrate' in navigator) navigator.vibrate(50);
    setClocking(true);
    try {
      if (type === 'in') {
        await attendanceApi.clockIn();
        window.dispatchEvent(new Event('clock-in-event'));
      } else {
        await attendanceApi.clockOut();
        window.dispatchEvent(new Event('clock-out-event'));
      }
      toast.success(type === 'in' ? 'Clocked in!' : 'Clocked out!');
      await fetchData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed. Please try again.');
    } finally {
      setClocking(false);
    }
  };

  // Calendar helpers
  const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const getClockInTimeForEmployee = (emp) => {
    const empIdNum = Number(emp.empId || emp.id);
    const rec = presentTodayRecords.find(a => Number(a.empId || a.empid) === empIdNum);
    if (rec && (rec.clockIn || rec.clockin)) {
      return new Date(rec.clockIn || rec.clockin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return null;
  };

  // Day status for Employee view
  const getDateStatus = (day) => {
    const d = new Date(currentMonth.year, currentMonth.month, day);
    d.setHours(0, 0, 0, 0);
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
    const key = toDateKey(d);

    if (dateOfJoining) {
      const doj = new Date(dateOfJoining); doj.setHours(0, 0, 0, 0);
      if (d < doj) return 'Disabled';
    }

    if (d > todayMid) return 'future';

    // Check holiday first
    const isHoliday = holidays.some(h => toDateKey(h.holidayDate || h.holidaydate) === key);
    if (isHoliday) return 'Holiday';

    const isToday = d.getTime() === todayMid.getTime();

    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = DAYS_SHORT[d.getDay()];
    const isWorking = workingDays.some(w => w.toLowerCase() === dayName.toLowerCase());

    const rec = recordMap[key];
    if (rec) {
      const status = rec.status || rec.Status || '';
      if (status.toLowerCase() === 'absent') {
        return 'Absent';
      }
      if (isWorking) {
        const late = (rec.lateMinutes || rec.lateminutes || 0) > 0;
        const early = (rec.earlyExitMinutes || rec.earlyexitminutes || 0) > 0;
        if (late) return 'Late';
        if (early) return 'EarlyExit';
      }
      return isToday ? 'today' : 'Present';
    }

    if (!isWorking) return 'weekend';
    if (isToday) return 'today';
    return 'Absent';
  };

  // Day status for selected employee (Admin view)
  const getSelectedDateStatus = (day) => {
    const d = new Date(currentMonth.year, currentMonth.month, day);
    d.setHours(0, 0, 0, 0);
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
    const key = toDateKey(d);

    if (selectedEmpDoj) {
      const doj = new Date(selectedEmpDoj); doj.setHours(0, 0, 0, 0);
      if (d < doj) return 'Disabled';
    }

    if (d > todayMid) return 'future';

    // Check holiday first
    const isHoliday = holidays.some(h => toDateKey(h.holidayDate || h.holidaydate) === key);
    if (isHoliday) return 'Holiday';

    const isToday = d.getTime() === todayMid.getTime();

    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = DAYS_SHORT[d.getDay()];
    const isWorking = selectedEmpWorkingDays.some(w => w.toLowerCase() === dayName.toLowerCase());

    const rec = selectedRecordMap[key];
    if (rec) {
      const status = rec.status || rec.Status || '';
      if (status.toLowerCase() === 'absent') {
        return 'Absent';
      }
      if (isWorking) {
        const late = (rec.lateMinutes || rec.lateminutes || 0) > 0;
        const early = (rec.earlyExitMinutes || rec.earlyexitminutes || 0) > 0;
        if (late) return 'Late';
        if (early) return 'EarlyExit';
      }
      return isToday ? 'today' : 'Present';
    }

    if (!isWorking) return 'weekend';
    if (isToday) return 'today';
    return 'Absent';
  };

  const getInitials = (name) => {
    if (!name) return 'E';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getActivityStatus = (dateStr, totalHours, clockIn, clockOut) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
    const key = toDateKey(d);

    const isWorkingDaysArray = isAdmin ? selectedEmpWorkingDays : workingDays;
    const doj = isAdmin ? selectedEmpDoj : dateOfJoining;

    if (doj) {
      const dojDate = new Date(doj); dojDate.setHours(0, 0, 0, 0);
      if (d < dojDate) return 'Disabled';
    }

    if (d > todayMid) return 'future';

    // Check holiday first
    const isHoliday = holidays.some(h => toDateKey(h.holidayDate || h.holidaydate) === key);
    if (isHoliday) return 'Holiday';

    const isToday = d.getTime() === todayMid.getTime();

    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = DAYS_SHORT[d.getDay()];
    const isWorking = isWorkingDaysArray.some(w => w.toLowerCase() === dayName.toLowerCase());

    const rec = (isAdmin ? selectedRecordMap : recordMap)[key];
    if (rec) {
      const status = rec.status || rec.Status || '';
      if (status.toLowerCase() === 'absent') {
        return 'Absent';
      }
      if (isWorking) {
        const late = (rec.lateMinutes || rec.lateminutes || 0) > 0;
        const early = (rec.earlyExitMinutes || rec.earlyexitminutes || 0) > 0;
        if (late) return 'Late';
        if (early) return 'EarlyExit';
      }
      return isToday ? 'today' : 'Present';
    }

    if (!isWorking) return 'weekend';
    if (isToday) return 'today';
    return 'Absent';
  };

  const renderActivityDetails = () => {
    const activeActivities = isAdmin ? selectedEmpActivities : dailyActivities;
    const selectedDateKey = selectedDay ? toDateKey(selectedDay) : null;
    const spotlightDay = activeActivities.find(act => toDateKey(act.date) === selectedDateKey);

    const formattedSpotlightDate = selectedDay
      ? selectedDay.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    // Filter by month
    const monthlyActivities = activeActivities.filter(act => {
      const d = new Date(act.date);
      return d.getMonth() === currentMonth.month && d.getFullYear() === currentMonth.year;
    });

    // Filter by search query
    const query = activitySearch.toLowerCase().trim();
    const filteredActivities = monthlyActivities.filter(act => {
      if (!query) return true;
      const formattedDate = new Date(act.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase();
      const hasTask = act.worklogs?.some(w =>
        (w.taskName || '').toLowerCase().includes(query) ||
        (w.description || '').toLowerCase().includes(query)
      );
      return formattedDate.includes(query) || hasTask;
    });

    // Sort activities in descending order so latest days are first
    const sortedActivities = [...filteredActivities].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get Spotlight day status style
    const spotlightStatus = spotlightDay
      ? getActivityStatus(spotlightDay.date, spotlightDay.totalHours, spotlightDay.clockIn, spotlightDay.clockOut)
      : 'Absent';
    const spotlightStyle = STATUS_STYLE[spotlightStatus] || STATUS_STYLE.future;

    return (
      <div style={{ marginTop: 30 }} className="fade-in">
        {/* Style block */}
        <style>{`
          .timeline-card {
            border: 1px solid var(--gray-200);
            border-radius: 12px;
            padding: 16px 16px 16px 20px;
            background: #fff;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            position: relative;
            z-index: 1;
          }
          .timeline-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.08);
            border-color: var(--primary-300);
          }
          .timeline-card.active {
            border-color: var(--primary-500);
            box-shadow: 0 0 0 2px var(--primary-100), 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            background: #F8FAFC;
          }
          .timeline-track-line {
            position: absolute;
            top: 24px;
            bottom: -24px;
            left: 21px;
            width: 2px;
            border-left: 2px dashed #E2E8F0;
            z-index: 0;
          }
          .timeline-item-container {
            position: relative;
          }
          .timeline-item-container:last-child .timeline-track-line {
            display: none;
          }
          .screenshot-thumbnail {
            width: 90px;
            height: 55px;
            object-fit: cover;
            border-radius: 6px;
            border: 1.5px solid var(--gray-200);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .screenshot-thumbnail:hover {
            transform: scale(1.08) translateY(-1px);
            border-color: var(--primary-500);
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          }
          .search-input-timeline {
            border: 1px solid var(--gray-200);
            border-radius: 8px;
            padding: 8px 12px 8px 36px;
            font-size: 13px;
            outline: none;
            width: 100%;
            transition: all 0.2s ease;
          }
          .search-input-timeline:focus {
            border-color: var(--primary-500);
            box-shadow: 0 0 0 3px var(--primary-100);
          }
          .spotlight-card {
            border-radius: 16px;
            background: linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%);
            border: 1px solid var(--gray-200);
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
          }
          .spotlight-stat-box {
            background: #fff;
            border: 1px solid var(--gray-100);
            border-radius: 10px;
            padding: 12px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.01);
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: var(--gray-300);
            border-radius: 10px;
          }
        `}</style>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'flex-start' }}>

          {/* Left Column: Spotlight details of the selected day */}
          <div className="spotlight-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--gray-100)', paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Day Spotlight</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-900)', margin: '4px 0 0 0' }}>{formattedSpotlightDate}</h3>
              </div>
              <span className="badge" style={{ background: spotlightStyle.bg, color: spotlightStyle.color, padding: '6px 12px', borderRadius: 999, fontWeight: 700, fontSize: 12 }}>
                {spotlightStyle.label}
              </span>
            </div>

            {/* Daily Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <div className="spotlight-stat-box">
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Clock In</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginTop: 4 }}>
                  {spotlightDay?.clockIn ? new Date(spotlightDay.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—:—'}
                </div>
              </div>
              <div className="spotlight-stat-box">
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Clock Out</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginTop: 4 }}>
                  {spotlightDay?.clockOut ? new Date(spotlightDay.clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—:—'}
                </div>
              </div>
              <div className="spotlight-stat-box" style={{ borderLeft: `3px solid ${spotlightStyle.dot}` }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Work Hours</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-600)', marginTop: 4 }}>
                  {spotlightDay?.totalHours > 0 ? `${Number(spotlightDay.totalHours).toFixed(1)} hrs` : '0.0 hrs'}
                </div>
              </div>
            </div>

            {/* Task Worklogs Section */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary-500)' }}>task_alt</span>
                Tasks Logged
              </h4>
              {!spotlightDay || !spotlightDay.worklogs || spotlightDay.worklogs.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, background: '#fff', border: '1.5px dashed var(--gray-200)', borderRadius: 12 }}>
                  No tasks logged on this day.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {spotlightDay.worklogs.map((w, idx) => (
                    <div key={idx} style={{ background: '#fff', border: '1px solid var(--gray-200)', padding: 14, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{w.taskName}</div>
                        {w.description && <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, marginBottom: 0, lineHeight: 1.4 }}>{w.description}</p>}
                      </div>
                      <span className="badge badge-primary" style={{ flexShrink: 0, padding: '4px 8px', fontSize: 11, borderRadius: 6, fontWeight: 700 }}>
                        {w.hoursWorked} hrs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Screenshots Section */}
            {spotlightDay && spotlightDay.screenshots && spotlightDay.screenshots.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary-500)' }}>photo_library</span>
                  Screenshots ({spotlightDay.screenshots.length})
                </h4>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: '#fff', border: '1px solid var(--gray-200)', padding: 12, borderRadius: 12 }}>
                  {spotlightDay.screenshots.map((s, idx) => (
                    <a key={idx} href={s.fileUrl} target="_blank" rel="noreferrer" title={`Captured at ${new Date(s.capturedAt).toLocaleTimeString()}`}>
                      <img src={s.fileUrl} alt="Captured screen" className="screenshot-thumbnail" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Timeline History List */}
          <div className="card" style={{ padding: 20, background: '#fff', border: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', maxHeight: '680px' }}>
            <div style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-900)', margin: 0 }}>Monthly Activities & Worklogs</h3>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4, marginBottom: 12 }}>Timeline of logs for {monthName}</p>

              {/* Search Box */}
              <div style={{ position: 'relative', width: '100%' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 18 }}>search</span>
                <input
                  type="text"
                  placeholder="Search worklogs or dates..."
                  className="search-input-timeline"
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                />
                {activitySearch && (
                  <button
                    onClick={() => setActivitySearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable list */}
            <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {sortedActivities.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--gray-300)', marginBottom: 8 }}>history</span>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>No activities found</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{activitySearch ? 'Try a different search term' : 'No logs recorded for this month'}</div>
                </div>
              ) : (
                sortedActivities.map((day, idx) => {
                  const dayDate = new Date(day.date);
                  const formattedDate = dayDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                  const isActive = toDateKey(dayDate) === selectedDateKey;
                  const status = getActivityStatus(day.date, day.totalHours, day.clockIn, day.clockOut);
                  const s = STATUS_STYLE[status] || STATUS_STYLE.future;

                  const hasWorklogs = day.worklogs && day.worklogs.length > 0;

                  return (
                    <div key={idx} className="timeline-item-container">
                      {/* Vertical line connecting nodes */}
                      <div className="timeline-track-line" />

                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        {/* Timeline Bullet Node */}
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: s.dot, border: '3.5px solid #fff',
                          boxShadow: '0 0 0 1.5px ' + s.dot,
                          marginTop: 20, marginLeft: 14, flexShrink: 0,
                          zIndex: 2, position: 'relative'
                        }} />

                        {/* Interactive Timeline Card */}
                        <div
                          className={`timeline-card ${isActive ? 'active' : ''}`}
                          onClick={() => setSelectedDay(new Date(day.date))}
                          style={{ flex: 1 }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>{formattedDate}</div>
                              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '8px 12px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                                  {day.clockIn ? new Date(day.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'} – {day.clockOut ? new Date(day.clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {day.totalHours > 0 && (
                                <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 600 }}>
                                  {Number(day.totalHours).toFixed(1)}h worked
                                </span>
                              )}
                              {day.missingHours > 0 && day.totalHours > 0 && (
                                <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 600 }}>
                                  -{Number(day.missingHours).toFixed(1)}h missing
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick summary of worklogs / task names */}
                          {hasWorklogs && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray-100)' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {day.worklogs.map((w, wIdx) => (
                                  <span key={wIdx} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, color: 'var(--gray-600)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.taskName}>
                                    📝 {w.taskName} ({w.hoursWorked}h)
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.name.trim()) {
      toast.error('Date and Name are required');
      return;
    }
    setAddingHoliday(true);
    try {
      await attendanceApi.addHoliday({
        holidayDate: newHoliday.date,
        name: newHoliday.name.trim(),
        type: newHoliday.type,
      });
      toast.success('Holiday added successfully!');
      setNewHoliday({ date: '', name: '', type: 'National Holiday' });
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add holiday');
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await attendanceApi.deleteHoliday(holidayId);
      toast.success('Holiday deleted successfully!');
      await fetchData();
    } catch (err) {
      toast.error('Failed to delete holiday');
    }
  };

  const renderAdminView = () => {
    const filteredSearchUsers = employees.filter(emp =>
      (emp.name || '').toLowerCase().includes(selectSearch.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(selectSearch.toLowerCase())
    );

    return (
      <AppLayout role={user?.role === 'Admin' ? 'admin' : 'employee'}>
        <div className="page-content fade-in" style={{ maxWidth: '1600px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Employee Attendance Tracker</h1>
              <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>Monitor employee attendance schedules and records</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '7.2fr 2.8fr', gap: 24, alignItems: 'flex-start' }}>
            {/* Left side (70%): Calendar and detailed activities */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {loadingSelectedEmp ? <CalendarSkeleton /> : (
                <>
                  {/* Selected employee Stats */}
                  <div className="grid grid-4" style={{ gap: 12 }}>
                    {[
                      { label: 'Present', value: selectedStats.presentCount, sub: 'days', color: '#059669', bg: '#D1FAE5', icon: 'check_circle' },
                      { label: 'Absent', value: selectedStats.absentCount, sub: 'days', color: '#DC2626', bg: '#FEE2E2', icon: 'cancel' },
                      { label: 'Late', value: selectedStats.lateCount, sub: 'days', color: '#D97706', bg: '#FEF3C7', icon: 'schedule' },
                      { label: 'Early Exit', value: selectedStats.earlyExitCount, sub: 'days', color: '#7C3AED', bg: '#F3E8FF', icon: 'directions_run' },
                    ].map(c => (
                      <div key={c.label} className="stat-card" style={{ padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: c.color, width: '100%', textAlign: 'center' }}>{c.icon}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.label}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</span>
                          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{c.sub}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{monthName}</h3>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="icon-btn" style={{ border: '1px solid var(--gray-200)', borderRadius: 6 }} onClick={() => setCurrentMonth(m => { const d = new Date(m.year, m.month - 1); return { month: d.getMonth(), year: d.getFullYear() }; })} aria-label="Previous month">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                          </button>
                          <button className="icon-btn" style={{ border: '1px solid var(--gray-200)', borderRadius: 6 }} onClick={() => setCurrentMonth(m => { const d = new Date(m.year, m.month + 1); return { month: d.getMonth(), year: d.getFullYear() }; })} aria-label="Next month">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {LEGEND.map(([c, l]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />
                            <span style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 500 }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                      {DAYS.map(d => (
                        <div key={d} style={{ padding: '10px 0', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', fontFamily: 'JetBrains Mono' }}>{d}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`e-${i}`} style={{ minHeight: 88, borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }} />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const status = getSelectedDateStatus(day);
                        const s = STATUS_STYLE[status] || STATUS_STYLE.future;
                        const key = toDateKey(new Date(currentMonth.year, currentMonth.month, day));
                        const rec = selectedRecordMap[key];
                        const clockTime = rec?.clockIn ? new Date(rec.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null;
                        const lateMin = rec ? (rec.lateMinutes || rec.lateminutes || 0) : 0;
                        const earlyMin = rec ? (rec.earlyExitMinutes || rec.earlyexitminutes || 0) : 0;
                        const isSelected = toDateKey(new Date(currentMonth.year, currentMonth.month, day)) === toDateKey(selectedDay);

                        return (
                          <div
                            key={day}
                            title={status === 'Late' ? `Late by ${lateMin} min` : status === 'EarlyExit' ? `Early exit by ${earlyMin} min` : s.label}
                            onClick={() => status !== 'Disabled' && setSelectedDay(new Date(currentMonth.year, currentMonth.month, day))}
                            style={{
                              minHeight: 88, borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)',
                              padding: 8, background: s.bg, position: 'relative',
                              opacity: status === 'Disabled' ? 0.45 : 1,
                              cursor: status === 'Disabled' ? 'not-allowed' : 'pointer',
                              border: isSelected ? '2px solid var(--primary-500)' : undefined,
                              boxShadow: isSelected ? '0 0 8px rgba(79, 70, 229, 0.2)' : 'none',
                              zIndex: isSelected ? 5 : 1,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: status === 'today' ? 800 : 500, color: s.color }}>{day}</span>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
                            </div>
                            {clockTime && <div style={{ fontSize: 10, color: s.color, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{clockTime}</div>}
                            {status === 'Late' && <div style={{ fontSize: 9, color: '#B45309', fontWeight: 600, marginTop: 2 }}>+{lateMin}m late</div>}
                            {status === 'EarlyExit' && <div style={{ fontSize: 9, color: '#7C3AED', fontWeight: 600, marginTop: 2 }}>-{earlyMin}m early</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {renderActivityDetails()}
                </>
              )}
            </div>

            {/* Right side (30%): Search, Roll Call, Holidays Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Employee Selector Card */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-600)' }}>Active Profile Spotlight</span>

                  {/* Search select dropdown */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--gray-100)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 10px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', marginRight: 6, fontSize: 18 }}>search</span>
                      <input
                        type="text"
                        placeholder="Search employee..."
                        value={selectSearch}
                        onChange={(e) => {
                          setSelectSearch(e.target.value);
                          setSearchDropdownOpen(true);
                        }}
                        onFocus={() => setSearchDropdownOpen(true)}
                        style={{ border: 'none', padding: '10px 0', outline: 'none', fontSize: 13, width: '100%', background: 'transparent' }}
                      />
                      {selectSearch && (
                        <button
                          onClick={() => { setSelectSearch(''); setSearchDropdownOpen(false); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                        </button>
                      )}
                    </div>
                    {searchDropdownOpen && filteredSearchUsers.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        background: '#fff', border: '1.5px solid var(--gray-200)',
                        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                        zIndex: 310, maxHeight: 220, overflowY: 'auto', marginTop: 4
                      }}>
                        {filteredSearchUsers.map(emp => (
                          <div
                            key={emp.empId || emp.id}
                            onClick={() => {
                              setSelectedEmpId(emp.empId || emp.id);
                              setSelectSearch(emp.name || emp.email);
                              setSearchDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              borderBottom: '1px solid var(--gray-100)',
                              display: 'flex', alignItems: 'center', gap: 10,
                              transition: 'background 0.1s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{getInitials(emp.name || emp.email)}</div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{emp.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{emp.email} ({emp.role})</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {activeEmployee && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--primary-50)', padding: '10px 12px', borderRadius: 8 }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{getInitials(activeEmployee.name || activeEmployee.email)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeEmployee.name || activeEmployee.email}</div>
                        <div style={{ fontSize: 10, color: 'var(--primary-700)', fontWeight: 600 }}>{activeEmployee.role}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Sidebar Widget (Tabs: Today's Roll Call vs Holidays) */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 450, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                  <button
                    onClick={() => setRightTab('rollcall')}
                    style={{
                      flex: 1, padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: rightTab === 'rollcall' ? 'var(--primary-600)' : 'var(--gray-500)',
                      borderBottom: rightTab === 'rollcall' ? '2.5px solid var(--primary-500)' : '2.5px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    Today's Roll Call
                  </button>
                  <button
                    onClick={() => setRightTab('holidays')}
                    style={{
                      flex: 1, padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: rightTab === 'holidays' ? 'var(--primary-600)' : 'var(--gray-500)',
                      borderBottom: rightTab === 'holidays' ? '2.5px solid var(--primary-500)' : '2.5px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    Holidays
                  </button>
                </div>

                <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {rightTab === 'rollcall' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {/* Search / Filter */}
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '6px 12px', marginBottom: 12 }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--gray-400)', marginRight: 6, fontSize: 18 }}>search</span>
                        <input
                          type="text"
                          placeholder="Filter roll call..."
                          value={listSearch}
                          onChange={(e) => setListSearch(e.target.value)}
                          style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: '100%' }}
                        />
                      </div>

                      {/* Sub-tabs: Present Today vs Not Present */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        <button
                          onClick={() => setRollCallTab('present')}
                          className="btn btn-sm"
                          style={{
                            flex: 1, fontSize: 11, padding: '6px 0', borderRadius: 6,
                            background: rollCallTab === 'present' ? '#D1FAE5' : 'transparent',
                            color: rollCallTab === 'present' ? '#065F46' : 'var(--gray-500)',
                            border: rollCallTab === 'present' ? '1px solid #10B981' : '1px solid var(--gray-200)'
                          }}
                        >
                          Present ({presentTodayList.length})
                        </button>
                        <button
                          onClick={() => setRollCallTab('absent')}
                          className="btn btn-sm"
                          style={{
                            flex: 1, fontSize: 11, padding: '6px 0', borderRadius: 6,
                            background: rollCallTab === 'absent' ? '#FEE2E2' : 'transparent',
                            color: rollCallTab === 'absent' ? '#991B1B' : 'var(--gray-500)',
                            border: rollCallTab === 'absent' ? '1px solid #EF4444' : '1px solid var(--gray-200)'
                          }}
                        >
                          Not Present ({absentTodayList.length})
                        </button>
                      </div>

                      {/* List area */}
                      <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, maxHeight: '320px' }}>
                        {rollCallTab === 'present' ? (
                          presentTodayList.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 12, border: '1px dashed var(--gray-200)', borderRadius: 8 }}>No employees present today</div>
                          ) : (
                            presentTodayList.map(emp => {
                              const isActive = Number(selectedEmpId) === Number(emp.empId || emp.id);
                              const clockInTime = getClockInTimeForEmployee(emp);
                              return (
                                <div
                                  key={emp.empId || emp.id}
                                  onClick={() => setSelectedEmpId(emp.empId || emp.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 10px', borderRadius: 8,
                                    background: isActive ? 'var(--primary-50)' : 'transparent',
                                    border: isActive ? '1.5px solid var(--primary-300)' : '1px solid var(--gray-200)',
                                    cursor: 'pointer', transition: 'all 0.15s ease', marginBottom: 6
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{getInitials(emp.name || emp.email)}</div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{emp.name || emp.email}</div>
                                      <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{emp.role}</div>
                                    </div>
                                  </div>
                                  {clockInTime && (
                                    <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>{clockInTime}</span>
                                  )}
                                </div>
                              );
                            })
                          )
                        ) : (
                          absentTodayList.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 12, border: '1px dashed var(--gray-200)', borderRadius: 8 }}>Everyone clocked in</div>
                          ) : (
                            absentTodayList.map(emp => {
                              const isActive = Number(selectedEmpId) === Number(emp.empId || emp.id);
                              return (
                                <div
                                  key={emp.empId || emp.id}
                                  onClick={() => setSelectedEmpId(emp.empId || emp.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 10px', borderRadius: 8,
                                    background: isActive ? 'var(--primary-50)' : 'transparent',
                                    border: isActive ? '1.5px solid var(--primary-300)' : '1px solid var(--gray-200)',
                                    cursor: 'pointer', transition: 'all 0.15s ease', marginBottom: 6
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{getInitials(emp.name || emp.email)}</div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{emp.name || emp.email}</div>
                                      <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{emp.role}</div>
                                    </div>
                                  </div>
                                  <span style={{ fontSize: 9, color: 'var(--gray-400)', fontStyle: 'italic' }}>Absent</span>
                                </div>
                              );
                            })
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                      {/* Holidays List */}
                      <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, maxHeight: '200px' }}>
                        {holidays.length === 0 ? (
                          <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 12, border: '1px dashed var(--gray-200)', borderRadius: 8 }}>No holidays defined yet</div>
                        ) : (
                          holidays.map(h => {
                            const dateStr = new Date(h.holidayDate || h.holidaydate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                            return (
                              <div key={h.holidayId || h.holidayid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#F8FAFC', border: '1px solid var(--gray-200)', borderRadius: 8, marginBottom: 6 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)' }}>{h.name}</div>
                                  <div style={{ fontSize: 10, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{dateStr}</span>
                                    <span>•</span>
                                    <span style={{ fontWeight: 600 }}>{h.type}</span>
                                  </div>
                                </div>
                                {user?.role === 'Admin' && (
                                  <button
                                    onClick={() => handleDeleteHoliday(h.holidayId || h.holidayid)}
                                    className="icon-btn"
                                    style={{ padding: 4, color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}
                                    title="Delete Holiday"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add Holiday Inline Form */}
                      {user?.role === 'Admin' && (
                        <form onSubmit={handleAddHoliday} style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase' }}>Add Holiday</span>
                          <input
                            type="date"
                            className="form-control"
                            style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}
                            value={newHoliday.date}
                            onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Holiday Name (e.g. Christmas)"
                            className="form-control"
                            style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}
                            value={newHoliday.name}
                            onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                          <select
                            className="form-control"
                            style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}
                            value={newHoliday.type}
                            onChange={(e) => setNewHoliday(prev => ({ ...prev, type: e.target.value }))}
                          >
                            <option value="National Holiday">National Holiday</option>
                            <option value="Regional Holiday">Regional Holiday</option>
                            <option value="Company Holiday">Company Holiday</option>
                          </select>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            disabled={addingHoliday}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                            {addingHoliday ? 'Adding...' : 'Add Holiday'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Joining Info / Employment Info */}
              {selectedEmpDoj && (
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Employment Info</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, background: 'var(--primary-50)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary-500)' }}>badge</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Date of Joining</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{selectedEmpDoj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Records */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Recent Records</h4>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {selectedEmpAttendance.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>No records found</div>
                  ) : (
                    selectedEmpAttendance.slice(0, 5).map((r, i) => {
                      const late = (r.lateMinutes || r.lateminutes || 0) > 0;
                      const early = (r.earlyExitMinutes || r.earlyexitminutes || 0) > 0;
                      const displayStatus = late ? 'Late' : early ? 'EarlyExit' : (r.status || 'Present');
                      const s = STATUS_STYLE[displayStatus] || STATUS_STYLE.Present;
                      return (
                        <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(r.attendanceDate || r.attendancedate || r.clockIn || r.clockin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                            <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>
                              {r.clockIn || r.clockin ? new Date(r.clockIn || r.clockin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'} – {r.clockOut || r.clockout ? new Date(r.clockOut || r.clockout).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                          </div>
                          <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 9 }}>{s.label}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </AppLayout>
    );
  };

  const renderEmployeeView = () => {
    return (
      <AppLayout role="employee">
        <div className="page-content fade-in">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Attendance Tracker</h1>
              <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>Manage your work schedule for {monthName}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-success" onClick={() => handleClock('in')} disabled={clocking} aria-label="Clock In">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>
                {clocking ? 'Processing...' : 'Clock In'}
              </button>
              <button className="btn btn-danger" onClick={() => handleClock('out')} disabled={clocking} aria-label="Clock Out">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                Clock Out
              </button>
            </div>
          </div>

          {/* Stats – dynamic, no hardcoded values */}
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            {[
              { label: 'Present', value: stats.presentCount, sub: 'days', color: '#059669', bg: '#D1FAE5', icon: 'check_circle' },
              { label: 'Absent', value: stats.absentCount, sub: 'days', color: '#DC2626', bg: '#FEE2E2', icon: 'cancel' },
              { label: 'Late', value: stats.lateCount, sub: 'days', color: '#D97706', bg: '#FEF3C7', icon: 'schedule' },
              { label: 'Early Exit', value: stats.earlyExitCount, sub: 'days', color: '#7C3AED', bg: '#F3E8FF', icon: 'directions_run' },
            ].map(c => (
              <div key={c.label} className="stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: c.color }}>{c.icon}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: c.color }}>{loading ? '—' : c.value}</span>
                  <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>{c.sub}</span>
                </div>
                <div className="progress-bar" style={{ marginTop: 6 }}>
                  <div className="progress-fill" style={{ width: `${stats.totalDays ? Math.min((c.value / stats.totalDays) * 100, 100) : 0}%`, background: c.color, transition: 'width .6s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Calendar + Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
            {loading ? <CalendarSkeleton /> : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Calendar header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{monthName}</h3>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="icon-btn" style={{ border: '1px solid var(--gray-200)', borderRadius: 6 }} onClick={() => setCurrentMonth(m => { const d = new Date(m.year, m.month - 1); return { month: d.getMonth(), year: d.getFullYear() }; })} aria-label="Previous month">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                      </button>
                      <button className="icon-btn" style={{ border: '1px solid var(--gray-200)', borderRadius: 6 }} onClick={() => setCurrentMonth(m => { const d = new Date(m.year, m.month + 1); return { month: d.getMonth(), year: d.getFullYear() }; })} aria-label="Next month">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {LEGEND.map(([c, l]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500 }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                  {DAYS.map(d => (
                    <div key={d} style={{ padding: '8px 0', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', fontFamily: 'JetBrains Mono' }}>{d}</span>
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e-${i}`} style={{ minHeight: 72, borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const status = getDateStatus(day);
                    const s = STATUS_STYLE[status] || STATUS_STYLE.future;
                    const key = toDateKey(new Date(currentMonth.year, currentMonth.month, day));
                    const rec = recordMap[key];
                    const clockTime = rec?.clockIn ? new Date(rec.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null;
                    const lateMin = rec ? (rec.lateMinutes || rec.lateminutes || 0) : 0;
                    const earlyMin = rec ? (rec.earlyExitMinutes || rec.earlyexitminutes || 0) : 0;

                    const isSelected = toDateKey(new Date(currentMonth.year, currentMonth.month, day)) === toDateKey(selectedDay);
                    return (
                      <div
                        key={day}
                        title={status === 'Late' ? `Late by ${lateMin} min` : status === 'EarlyExit' ? `Early exit by ${earlyMin} min` : s.label}
                        onClick={() => status !== 'Disabled' && setSelectedDay(new Date(currentMonth.year, currentMonth.month, day))}
                        style={{
                          minHeight: 72, borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)',
                          padding: 6, background: s.bg, position: 'relative',
                          opacity: status === 'Disabled' ? 0.45 : 1,
                          cursor: status === 'Disabled' ? 'not-allowed' : 'pointer',
                          border: isSelected ? '2px solid var(--primary-500)' : undefined,
                          boxShadow: isSelected ? '0 0 8px rgba(79, 70, 229, 0.2)' : 'none',
                          zIndex: isSelected ? 5 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: status === 'today' ? 800 : 500, color: s.color }}>{day}</span>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
                        </div>
                        {clockTime && <div style={{ fontSize: 10, color: s.color, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{clockTime}</div>}
                        {status === 'Late' && <div style={{ fontSize: 9, color: '#B45309', fontWeight: 600, marginTop: 2 }}>+{lateMin}m late</div>}
                        {status === 'EarlyExit' && <div style={{ fontSize: 9, color: '#7C3AED', fontWeight: 600, marginTop: 2 }}>-{earlyMin}m early</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Side panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Joining info */}
              {dateOfJoining && (
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Employment Info</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, background: 'var(--primary-50)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary-500)' }}>badge</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Joined</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{dateOfJoining.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Holidays */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Upcoming Holidays</h4>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 220, overflowY: 'auto' }}>
                  {holidays.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', padding: 8 }}>No upcoming holidays</div>
                  ) : (
                    holidays.slice(0, 5).map(h => {
                      const d = new Date(h.holidayDate || h.holidaydate);
                      const monName = d.toLocaleString('default', { month: 'short' }).toUpperCase();
                      const dayName = d.getDate();
                      return (
                        <div key={h.holidayId || h.holidayid} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 44, height: 44, background: 'var(--primary-50)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-500)', fontFamily: 'JetBrains Mono' }}>{monName}</span>
                            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-700)', lineHeight: 1 }}>{dayName}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{h.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{h.type}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent Records */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Recent Records</h4>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {records.length === 0 && !loading && (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>No records found</div>
                  )}
                  {records.slice(0, 5).map((r, i) => {
                    const late = (r.lateMinutes || r.lateminutes || 0) > 0;
                    const early = (r.earlyExitMinutes || r.earlyexitminutes || 0) > 0;
                    const displayStatus = late ? 'Late' : early ? 'EarlyExit' : (r.status || 'Present');
                    const s = STATUS_STYLE[displayStatus] || STATUS_STYLE.Present;
                    return (
                      <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(r.attendanceDate || r.attendancedate || r.clockIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                            {r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'} – {r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                        </div>
                        <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 10 }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {renderActivityDetails()}
        </div>
      </AppLayout>
    );
  };

  return isAdmin ? renderAdminView() : renderEmployeeView();
}
