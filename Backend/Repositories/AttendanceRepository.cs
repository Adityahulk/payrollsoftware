namespace Backend.Repositories;

using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;
using System;

public class AttendanceRepository : IAttendanceRepository
{
    private readonly IDbConnection _dbConnection;

    public AttendanceRepository(IDbConnection dbConnection)
    {
        _dbConnection = dbConnection;
    }

    public async Task<IEnumerable<Attendance>> GetAttendanceByUserIdAsync(int empid)
    {
        var query = @"SELECT attendanceid, empid, attendancedate::timestamp AS attendancedate, clockin, clockout, totalhours, status, lateminutes, earlyexitminutes, createdat 
                      FROM t_attendance WHERE empid = @EmpId ORDER BY attendancedate DESC";
        return await _dbConnection.QueryAsync<Attendance>(query, new { EmpId = empid });
    }

    public async Task<bool> ClockInAsync(int empId)
    {
        var now = DateTime.Now;
        var checkQuery = @"SELECT COUNT(1) 
                           FROM t_attendance 
                           WHERE empid = @EmpId AND DATE(clockin) = @Today";

        var exists = await _dbConnection.ExecuteScalarAsync<int>(checkQuery, new { EmpId = empId, Today = now.Date });

        if (exists > 0)
            return false;

        var times = await GetSpaceWorkTimesAsync(empId);
        int lateMinutes = 0;

        // Check if today is a working day
        var workingDays = await GetWorkingDaysByEmpIdAsync(empId);
        string todayName = Space.DayOfWeekToShortName(now.DayOfWeek);
        bool isWorkingDay = workingDays.Contains(todayName, StringComparer.OrdinalIgnoreCase);

        if (isWorkingDay && times.StartTime.HasValue)
        {
            var expectedStart = now.Date.Add(times.StartTime.Value);
            if (now > expectedStart)
            {
                lateMinutes = (int)(now - expectedStart).TotalMinutes;
            }
        }

        var insertQuery = @"INSERT INTO t_attendance (empid, attendancedate, clockin, status, lateminutes, createdat)
                            VALUES (@EmpId, @Today, @Now, 'Present', @LateMinutes, @Now)";

        var result = await _dbConnection.ExecuteAsync(insertQuery, new { EmpId = empId, Today = now.Date, Now = now, LateMinutes = lateMinutes });

        return result > 0;
    }

    public async Task<bool> ClockOutAsync(int attendanceId, DateTime clockOut, decimal totalHours, int earlyExitMinutes)
    {
        // Advanced: Store Overtime
        decimal overtimeHours = 0;
        decimal breakHours = 0;
        
        // Find the empId and times
        var empIdQuery = "SELECT empid FROM t_attendance WHERE attendanceid = @AttendanceId";
        var empId = await _dbConnection.ExecuteScalarAsync<int>(empIdQuery, new { AttendanceId = attendanceId });
        if (empId > 0)
        {
            var times = await GetSpaceWorkTimesAsync(empId);
            if (times.WorkingHours.HasValue && totalHours > (decimal)times.WorkingHours.Value)
            {
                overtimeHours = totalHours - (decimal)times.WorkingHours.Value;
            }
        }

        // Calculate total break hours
        var breakQuery = @"
            SELECT COALESCE(SUM(totalbreakminutes), 0)
            FROM employeebreaks
            WHERE empid = @EmpId AND DATE(breakstart) = DATE(@ClockOut)";
        var totalBreakMinutes = await _dbConnection.ExecuteScalarAsync<int>(breakQuery, new { EmpId = empId, ClockOut = clockOut });
        breakHours = Math.Round((decimal)totalBreakMinutes / 60, 2);

        var query = @"
            UPDATE t_attendance 
            SET clockout = @ClockOut, 
                totalhours = @TotalHours, 
                earlyexitminutes = @EarlyExitMinutes,
                overtimehours = @OvertimeHours,
                breakhours = @BreakHours
            WHERE attendanceid = @AttendanceId";
        var result = await _dbConnection.ExecuteAsync(query, new { 
            ClockOut = clockOut, 
            TotalHours = totalHours, 
            EarlyExitMinutes = earlyExitMinutes, 
            OvertimeHours = overtimeHours,
            BreakHours = breakHours,
            AttendanceId = attendanceId 
        });
        return result > 0;
    }

    public async Task<IEnumerable<Attendance>> GetAllAttendanceAsync()
    {
        var query = @"SELECT attendanceid, empid, attendancedate::timestamp AS attendancedate, clockin, clockout, totalhours, status, lateminutes, earlyexitminutes, createdat 
                      FROM t_attendance ORDER BY attendancedate DESC LIMIT 5000";
        return await _dbConnection.QueryAsync<Attendance>(query);
    }

    // Optimized: fetches attendance filtered by space at the DB level (no C# post-filter)
    public async Task<IEnumerable<Attendance>> GetAttendanceBySpaceIdAsync(int spaceId, int? limitRows = 500)
    {
        var query = @"
            SELECT a.attendanceid, a.empid, a.attendancedate::timestamp AS attendancedate,
                   a.clockin, a.clockout, a.totalhours, a.status,
                   a.lateminutes, a.earlyexitminutes, a.createdat
            FROM t_attendance a
            JOIN t_users u ON a.empid = u.empid
            WHERE u.spaceid = @SpaceId
            ORDER BY a.attendancedate DESC
            LIMIT @Limit;";
        return await _dbConnection.QueryAsync<Attendance>(query, new { SpaceId = spaceId, Limit = limitRows ?? 500 });
    }

    public async Task<bool> StartBreakAsync(int empId)
    {
        var now = DateTime.Now;
        var today = now.Date;

        // STEP 1: check active break FIRST
        var activeBreakStart = await _dbConnection.ExecuteScalarAsync<DateTime?>(
            @"SELECT breakstart
              FROM employeebreaks
              WHERE empid = @EmpId
              AND breakend IS NULL
              ORDER BY breakstart DESC
              LIMIT 1",
            new { EmpId = empId });

        if (activeBreakStart.HasValue)
            throw new InvalidOperationException("Break already active");

        // STEP 2: cooldown check (ONLY if no active break)
        var lastBreakEnd = await _dbConnection.ExecuteScalarAsync<DateTime?>(
            @"SELECT MAX(breakend)
              FROM employeebreaks
              WHERE empid = @EmpId",
            new { EmpId = empId });

        if (lastBreakEnd.HasValue && (now - lastBreakEnd.Value).TotalMinutes < 5)
        {
            throw new InvalidOperationException("Wait before starting next break");
        }

        // 1. Get space config (number of breaks allowed, total break time allowed)
        var spaceConfig = await _dbConnection.QueryFirstOrDefaultAsync<dynamic>(
            @"SELECT s.numberofbreaks, s.breaktime
              FROM t_spaces s
              INNER JOIN t_users u ON u.spaceid = s.spaceid
              WHERE u.empid = @EmpId",
            new { EmpId = empId }) as IDictionary<string, object>;

        int maxBreaks = 2; // Default fallback
        int maxBreakMinutes = 60; // Default fallback

        if (spaceConfig != null)
        {
            if (spaceConfig.TryGetValue("numberofbreaks", out var nb) && nb != null)
                maxBreaks = Convert.ToInt32(nb);
            if (spaceConfig.TryGetValue("breaktime", out var bt) && bt != null)
                maxBreakMinutes = Convert.ToInt32(bt);
        }

        // 2. Count today's breaks
        var breakCount = await _dbConnection.ExecuteScalarAsync<int>(
            @"SELECT COUNT(*)
              FROM employeebreaks
              WHERE empid = @EmpId
              AND breakstart >= @Today
              AND breakstart < @Today + INTERVAL '1 day'",
            new { EmpId = empId, Today = today });

        if (breakCount >= maxBreaks)
            throw new InvalidOperationException("Max number of breaks reached");

        // 3. Check total break minutes
        var totalMinutes = await _dbConnection.ExecuteScalarAsync<int>(
            @"SELECT COALESCE(SUM(totalbreakminutes), 0)
              FROM employeebreaks
              WHERE empid = @EmpId
              AND breakstart >= @Today
              AND breakstart < @Today + INTERVAL '1 day'",
            new { EmpId = empId, Today = today });

        if (totalMinutes >= maxBreakMinutes)
            throw new InvalidOperationException("Daily break limit reached");

        // 5. Insert new break
        await _dbConnection.ExecuteAsync(
            @"INSERT INTO employeebreaks(empid, breakstart, createdat)
              VALUES (@EmpId, @Now, @Now)",
            new { EmpId = empId, Now = now });

        return true;
    }

    public async Task<bool> EndBreakAsync(int empId)
    {
        var now = DateTime.Now;
        var breakData = await _dbConnection.QueryFirstOrDefaultAsync<dynamic>(
            @"SELECT breakid, breakstart
              FROM employeebreaks
              WHERE empid = @EmpId AND breakend IS NULL",
            new { EmpId = empId });

        if (breakData == null) return false;

        var minutes = (int)(now - (DateTime)breakData.breakstart).TotalMinutes;

        if (minutes < 10)
            throw new InvalidOperationException($"Minimum break time is 10 minutes. You have only taken {minutes} minute(s).");

        await _dbConnection.ExecuteAsync(
            @"UPDATE employeebreaks
              SET breakend = @Now,
                  totalbreakminutes = @Minutes
              WHERE breakid = @BreakId",
            new { Now = now, Minutes = minutes, BreakId = breakData.breakid });

        return true;
    }

    public async Task<DateTime?> GetActiveBreakStartAsync(int empId)
    {
        var query = @"SELECT breakstart 
                      FROM employeebreaks 
                      WHERE empid = @EmpId 
                      AND breakend IS NULL 
                      ORDER BY breakstart DESC LIMIT 1";
        return await _dbConnection.QueryFirstOrDefaultAsync<DateTime?>(query, new { EmpId = empId });
    }

    public async Task<DateTime> GetDateOfJoiningAsync(int empId)
    {
        var query = @"SELECT COALESCE(dateofjoining, CURRENT_DATE)::timestamp FROM t_users WHERE empid = @EmpId";
        var resultRaw = await _dbConnection.ExecuteScalarAsync(query, new { EmpId = empId });
        DateTime result = resultRaw != null ? Convert.ToDateTime(resultRaw) : DateTime.Today;
        return result == default ? DateTime.Today : result;
    }

    public async Task<(TimeSpan? StartTime, TimeSpan? EndTime, int? WorkingHours)> GetSpaceWorkTimesAsync(int empId)
    {
        var query = @"
            SELECT s.workstarttime::text as workstarttime, 
                   s.workendtime::text as workendtime, 
                   s.workinghours
            FROM t_spaces s
            INNER JOIN t_users u ON u.spaceid = s.spaceid
            WHERE u.empid = @EmpId";
            
        var result = await _dbConnection.QueryFirstOrDefaultAsync<dynamic>(query, new { EmpId = empId });
        
        if (result == null) return (TimeSpan.FromHours(9), TimeSpan.FromHours(18), 8);

        TimeSpan? start = result.workstarttime != null ? TimeSpan.Parse((string)result.workstarttime) : TimeSpan.FromHours(9);
        TimeSpan? end = result.workendtime != null ? TimeSpan.Parse((string)result.workendtime) : TimeSpan.FromHours(18);
        int? workingHours = result.workinghours != null ? (int)result.workinghours : 8;

        return (start, end, workingHours);
    }

    public async Task TestClearTodayAsync(int empId)
    {
        await _dbConnection.ExecuteAsync("DELETE FROM t_attendance WHERE empid = @EmpId AND DATE(attendancedate) = CURRENT_DATE", new { EmpId = empId });
    }

    public async Task<dynamic> GetTrendsAsync(int empId)
    {
        var doj = await GetDateOfJoiningAsync(empId);
        var workingDays = await GetWorkingDaysByEmpIdAsync(empId);

        var spaceIdSql = "SELECT spaceid FROM t_users WHERE empid = @EmpId";
        var spaceId = await _dbConnection.ExecuteScalarAsync<int>(spaceIdSql, new { EmpId = empId });

        var holidaySql = "SELECT holidaydate::timestamp AS holidaydate FROM t_holidays WHERE spaceid = @SpaceId";
        var holidaysRaw = await _dbConnection.QueryAsync<dynamic>(holidaySql, new { SpaceId = spaceId });
        var holidaysSet = new System.Collections.Generic.HashSet<DateTime>();
        foreach (var h in holidaysRaw ?? System.Linq.Enumerable.Empty<dynamic>())
        {
            if (h.holidaydate != null)
            {
                DateTime parsedDate;
                if (DateTime.TryParse(h.holidaydate.ToString(), out parsedDate))
                {
                    holidaysSet.Add(parsedDate.Date);
                }
            }
        }

        // Generate ALL dates from DOJ to today (no weekend filter - use working days instead)
        var datesSql = @"
            SELECT (d::date)::timestamp as date
            FROM generate_series(@Doj::date, CURRENT_DATE::date, '1 day'::interval) d
            ORDER BY d ASC";
        var datesRaw = await _dbConnection.QueryAsync<DateTime?>(datesSql, new { Doj = doj });
        var dates = (datesRaw ?? System.Linq.Enumerable.Empty<DateTime?>())
            .Where(d => d.HasValue)
            .Select(d => d.Value)
            .ToList();

        var monthlySql = @"
            SELECT (a.attendancedate::date)::timestamp as date, 
                   COALESCE(w.workedhours, a.totalhours) as totalHours,
                   a.breakhours as breakHours,
                   a.lateminutes as lateMinutes,
                   a.earlyexitminutes as earlyExitMinutes
            FROM t_attendance a
            LEFT JOIN (
                SELECT workdate, SUM(hoursworked) as workedhours 
                FROM t_worklogs 
                WHERE empid = @EmpId 
                GROUP BY workdate
            ) w ON w.workdate = DATE(a.attendancedate)
            WHERE a.empid = @EmpId AND a.attendancedate >= @Doj";
        
        var attendanceRaw = await _dbConnection.QueryAsync<dynamic>(monthlySql, new { EmpId = empId, Doj = doj });
        var attendanceDict = new System.Collections.Generic.Dictionary<DateTime, dynamic>();
        foreach (var att in attendanceRaw) {
            attendanceDict[((DateTime)att.date).Date] = att;
        }

        var leaveSql = "SELECT leavedate::timestamp FROM t_leaves WHERE empid = @EmpId AND status = 'Approved'";
        var approvedLeaves = new System.Collections.Generic.HashSet<DateTime>();
        var leavesRaw = await _dbConnection.QueryAsync<DateTime?>(leaveSql, new { EmpId = empId });
        foreach (var l in leavesRaw ?? System.Linq.Enumerable.Empty<DateTime?>()) {
            if (l.HasValue) {
                approvedLeaves.Add(l.Value.Date);
            }
        }

        var monthlyResult = new System.Collections.Generic.List<dynamic>();
        decimal sumTotalHours = 0;
        decimal sumBreakHours = 0;
        int sumPenalty = 0;

        foreach (var d in dates)
        {
            var dt = d.Date;
            string dayName = Space.DayOfWeekToShortName(dt.DayOfWeek);
            bool isWorkingDay = workingDays.Contains(dayName, StringComparer.OrdinalIgnoreCase);

            if (attendanceDict.TryGetValue(dt, out var att))
            {
                var th = Convert.ToDecimal(att.totalhours ?? 0);
                var bh = Convert.ToDecimal(att.breakhours ?? 0);
                // On off-days, suppress penalty minutes
                var lm = isWorkingDay ? Convert.ToInt32(att.lateminutes ?? 0) : 0;
                var em = isWorkingDay ? Convert.ToInt32(att.earlyexitminutes ?? 0) : 0;
                var pen = lm + em;
                
                sumTotalHours += th;
                sumBreakHours += bh;
                sumPenalty += pen;

                monthlyResult.Add(new {
                    date = dt,
                    totalHours = th,
                    breakHours = bh,
                    status = "Present",
                    lateMinutes = lm,
                    earlyExitMinutes = em
                });
            }
            else if (approvedLeaves.Contains(dt))
            {
                monthlyResult.Add(new { date = dt, totalHours = 0, breakHours = 0, status = "Leave", lateMinutes = 0, earlyExitMinutes = 0 });
            }
            else if (holidaysSet.Contains(dt))
            {
                monthlyResult.Add(new { date = dt, totalHours = 0, breakHours = 0, status = "Holiday", lateMinutes = 0, earlyExitMinutes = 0 });
            }
            else if (!isWorkingDay)
            {
                // Off day with no clock-in = Off Day (not absent)
                monthlyResult.Add(new { date = dt, totalHours = 0, breakHours = 0, status = "Off", lateMinutes = 0, earlyExitMinutes = 0 });
            }
            else
            {
                monthlyResult.Add(new { date = dt, totalHours = 0, breakHours = 0, status = "Absent", lateMinutes = 0, earlyExitMinutes = 0 });
            }
        }

        var weeklySql = @"
            SELECT 
                (date_trunc('week', attendancedate)::date)::timestamp as weekStart,
                SUM(COALESCE(w.workedhours, a.totalhours)) as totalHours,
                SUM(COALESCE(a.breakhours, 0)) as breakHours,
                SUM(COALESCE(a.lateminutes, 0) + COALESCE(a.earlyexitminutes, 0)) as penaltyMinutes
            FROM t_attendance a
            LEFT JOIN (
                SELECT workdate, SUM(hoursworked) as workedhours 
                FROM t_worklogs 
                WHERE empid = @EmpId 
                GROUP BY workdate
            ) w ON w.workdate = DATE(a.attendancedate)
            WHERE a.empid = @EmpId
            GROUP BY weekStart
            ORDER BY weekStart ASC";
        var weeklyData = await _dbConnection.QueryAsync<dynamic>(weeklySql, new { EmpId = empId });

        var sixMonthsSql = @"
            SELECT 
                (date_trunc('month', attendancedate)::date)::timestamp as month,
                SUM(COALESCE(w.workedhours, a.totalhours)) as totalHours,
                SUM(COALESCE(a.lateminutes, 0) + COALESCE(a.earlyexitminutes, 0)) as penaltyMinutes
            FROM t_attendance a
            LEFT JOIN (
                SELECT workdate, SUM(hoursworked) as workedhours 
                FROM t_worklogs 
                WHERE empid = @EmpId 
                GROUP BY workdate
            ) w ON w.workdate = DATE(a.attendancedate)
            WHERE a.empid = @EmpId
            GROUP BY month
            ORDER BY month DESC LIMIT 6";
        var sixMonthsData = await _dbConnection.QueryAsync<dynamic>(sixMonthsSql, new { EmpId = empId });

        return new {
            monthly = monthlyResult,
            weekly = weeklyData,
            sixMonths = sixMonthsData,
            summary = new {
                totalHours = sumTotalHours,
                totalBreakHours = sumBreakHours,
                totalPenaltyMinutes = sumPenalty
            }
        };
    }

    public async Task<List<string>> GetWorkingDaysByEmpIdAsync(int empId)
    {
        var query = @"
            SELECT s.workingdays
            FROM t_spaces s
            INNER JOIN t_users u ON u.spaceid = s.spaceid
            WHERE u.empid = @EmpId";
        var raw = await _dbConnection.QueryFirstOrDefaultAsync<string>(query, new { EmpId = empId });

        if (!string.IsNullOrWhiteSpace(raw))
        {
            try
            {
                var parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(raw);
                if (parsed != null && parsed.Count > 0) return parsed;
            }
            catch { }
        }

        return new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri" };
    }

    public async Task<IEnumerable<Holiday>> GetHolidaysBySpaceIdAsync(int spaceId)
    {
        var query = "SELECT holidayid, holidaydate, name, type, spaceid FROM t_holidays WHERE spaceid = @SpaceId ORDER BY holidaydate ASC;";
        return await _dbConnection.QueryAsync<Holiday>(query, new { SpaceId = spaceId });
    }

    public async Task<bool> AddHolidayAsync(Holiday holiday)
    {
        var query = @"
            INSERT INTO t_holidays (holidaydate, name, type, spaceid)
            VALUES (@HolidayDate, @Name, @Type, @SpaceId)
            ON CONFLICT (spaceid, holidaydate) DO UPDATE SET name = @Name, type = @Type;";
        var result = await _dbConnection.ExecuteAsync(query, holiday);
        return result > 0;
    }

    public async Task<bool> DeleteHolidayAsync(int holidayId, int spaceId)
    {
        var query = "DELETE FROM t_holidays WHERE holidayid = @HolidayId AND spaceid = @SpaceId;";
        var result = await _dbConnection.ExecuteAsync(query, new { HolidayId = holidayId, SpaceId = spaceId });
        return result > 0;
    }
}
