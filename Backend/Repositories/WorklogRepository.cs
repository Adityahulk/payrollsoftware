namespace Backend.Repositories;

using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class WorklogRepository : IWorklogRepository
{
    private readonly IDbConnection _db;

    public WorklogRepository(IDbConnection db)
    {
        _db = db;
    }

    // ── Is task assigned to this employee? (uses t_projecttasks only) ──────
    public async Task<bool> IsTaskAssignedToEmpAsync(int taskId, int empId)
    {
        var sql = @"
            SELECT COUNT(1) 
            FROM t_projecttasks 
            WHERE taskid = @TaskId AND assignedtoempid = @EmpId";
        var count = await _db.ExecuteScalarAsync<int>(sql, new { TaskId = taskId, EmpId = empId });
        return count > 0;
    }

    // ── Insert new worklog row ──────────────────────────────────────────────
    public async Task<int> CreateWorklogAsync(WorkLog log)
    {
        var sql = @"
            INSERT INTO t_worklogs (empid, taskid, hoursworked, description, workdate)
            VALUES (@EmpId, @TaskId, @HoursWorked, @Description, NOW()::date)
            RETURNING logid";
        return await _db.ExecuteScalarAsync<int>(sql, log);
    }

    // ── Get all worklogs for an employee ───────────────────────────────────
    public async Task<IEnumerable<WorkLogDetail>> GetWorklogsByEmpIdAsync(int empId)
    {
        var sql = @"
            SELECT 
                w.logid,
                w.hoursworked,
                w.description,
                w.workdate::timestamp AS workdate,
                COALESCE(t.tasktitle, 'Unknown Task')    AS title,
                COALESCE(p.projectname, 'Unknown Project') AS projectname
            FROM t_worklogs w
            LEFT JOIN t_projecttasks t ON w.taskid = t.taskid
            LEFT JOIN t_projects     p ON t.projectid = p.projectid
            WHERE w.empid = @EmpId
              AND w.workdate >= date_trunc('week', CURRENT_DATE)::date
            ORDER BY w.workdate DESC";
        return await _db.QueryAsync<WorkLogDetail>(sql, new { EmpId = empId });
    }

    public async Task<IEnumerable<TaskProgress>> GetTaskProgressByEmpIdAsync(int empId)
    {
        var sql = @"
            SELECT 
                t.taskid,
                t.tasktitle AS title,
                t.projectid,
                p.projectname AS projectname,
                COALESCE(t.estimatedhours, 8) AS estimatedhours,
                COALESCE(SUM(w.hoursworked), 0) AS actualhours,
                GREATEST(COALESCE(t.estimatedhours, 8) - COALESCE(SUM(w.hoursworked), 0), 0) AS remaininghours,
                CASE 
                    WHEN COALESCE(t.estimatedhours, 8) = 0 THEN 0
                    ELSE LEAST(
                        CAST(COALESCE(SUM(w.hoursworked), 0) * 100
                             / COALESCE(t.estimatedhours, 8) AS INTEGER),
                        100)
                END AS completionpercentage,
                CASE 
                    WHEN t.taskstatus IN ('Completed', 'Complete', 'Resolve') THEN 'Completed'
                    WHEN COALESCE(SUM(w.hoursworked), 0) >= COALESCE(t.estimatedhours, 8) THEN 'Completed'
                    WHEN t.taskstatus IN ('Active', 'InProgress', 'In Progress') THEN 'In Progress'
                    WHEN COALESCE(SUM(w.hoursworked), 0) > 0 THEN 'In Progress'
                    ELSE 'Pending'
                END AS status
            FROM t_projecttasks t
            LEFT JOIN t_projects p ON p.projectid = t.projectid
            LEFT JOIN t_worklogs w ON t.taskid = w.taskid AND w.empid = @EmpId
                AND EXTRACT(MONTH FROM w.workdate) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND EXTRACT(YEAR FROM w.workdate) = EXTRACT(YEAR FROM CURRENT_DATE)
            WHERE t.assignedtoempid = @EmpId
              AND (
                  t.taskstatus NOT IN ('Completed', 'Complete', 'Resolve')
                  OR (EXTRACT(MONTH FROM t.completedat) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM t.completedat) = EXTRACT(YEAR FROM CURRENT_DATE))
                  OR t.taskid IN (
                      SELECT DISTINCT taskid FROM t_worklogs 
                      WHERE empid = @EmpId 
                        AND EXTRACT(MONTH FROM workdate) = EXTRACT(MONTH FROM CURRENT_DATE)
                        AND EXTRACT(YEAR FROM workdate) = EXTRACT(YEAR FROM CURRENT_DATE)
                  )
              )
            GROUP BY t.taskid, t.tasktitle, t.estimatedhours, t.taskstatus, p.projectname, t.projectid
            ORDER BY t.taskid";

        return await _db.QueryAsync<TaskProgress>(sql, new { EmpId = empId });
    }

    private class EmployeeBreakQueryResult
    {
        public DateTime BreakStart { get; set; }
        public DateTime? BreakEnd { get; set; }
        public int? TotalBreakMinutes { get; set; }
    }

    public async Task<IEnumerable<WorklogChartDto>> GetWorklogsChartAsync(int empId, string range)
    {
        var today = DateTime.Today;
        var startDate = today;
        var endDate = today;

        // Normalize range parameter
        range = (range ?? "monthly").ToLower().Replace(" ", "");

        if (range == "weekly")
        {
            int diff = (7 + (today.DayOfWeek - DayOfWeek.Monday)) % 7;
            startDate = today.AddDays(-diff).Date;
            endDate = startDate.AddDays(6).Date;
        }
        else if (range == "6months")
        {
            startDate = new DateTime(today.Year, today.Month, 1).AddMonths(-5);
            endDate = new DateTime(today.Year, today.Month, 1).AddMonths(1).AddDays(-1);
        }
        else // default to monthly
        {
            startDate = new DateTime(today.Year, today.Month, 1);
            endDate = startDate.AddMonths(1).AddDays(-1);
        }

        // 1. Fetch standard expected working hours for the employee
        var expectedHoursSql = @"
            SELECT COALESCE(s.workinghours, 8) 
            FROM t_spaces s
            INNER JOIN t_users u ON u.spaceid = s.spaceid
            WHERE u.empid = @EmpId";
        decimal expectedHoursPerDay = await _db.ExecuteScalarAsync<decimal>(expectedHoursSql, new { EmpId = empId });
        if (expectedHoursPerDay <= 0) expectedHoursPerDay = 8m;

        // Fetch employee date of joining to set expected hours to 0 before DOJ
        var dojSql = "SELECT COALESCE(dateofjoining, CURRENT_DATE)::timestamp FROM t_users WHERE empid = @EmpId";
        var doj = await _db.ExecuteScalarAsync<DateTime>(dojSql, new { EmpId = empId });
        if (doj == default) doj = DateTime.Today;

        // 2. Fetch attendance records (DATA SOURCE: t_attendance only — no t_worklogs)
        var attSql = @"
            SELECT attendancedate::timestamp as AttendanceDate, clockin as ClockIn, clockout as ClockOut, totalhours as TotalHours, breakhours as BreakHours 
            FROM t_attendance 
            WHERE empid = @EmpId AND attendancedate >= @StartDate AND attendancedate <= @EndDate";
        var attendance = await _db.QueryAsync<Attendance>(attSql, new { EmpId = empId, StartDate = startDate, EndDate = endDate });

        // 3. Fetch breaks (DATA SOURCE: employeebreaks only)
        var breaksSql = @"
            SELECT breakstart as BreakStart, breakend as BreakEnd, totalbreakminutes as TotalBreakMinutes 
            FROM employeebreaks 
            WHERE empid = @EmpId AND breakstart >= @StartDate AND breakstart < @EndDateAddOne";
        var breaks = await _db.QueryAsync<EmployeeBreakQueryResult>(breaksSql, new { EmpId = empId, StartDate = startDate, EndDateAddOne = endDate.AddDays(1) });

        var dailyData = new Dictionary<DateTime, WorklogChartDto>();

        for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
        {
            var attForDay = attendance.FirstOrDefault(a => a.AttendanceDate.HasValue && a.AttendanceDate.Value.Date == date);
            var breaksForDay = breaks.Where(b => b.BreakStart.Date == date).ToList();

            // Calculate total time from clockin/clockout (no t_worklogs)
            decimal totalTimeHours = 0;
            if (attForDay != null && attForDay.ClockIn.HasValue)
            {
                if (attForDay.ClockOut.HasValue)
                {
                    totalTimeHours = (decimal)(attForDay.ClockOut.Value - attForDay.ClockIn.Value).TotalHours;
                }
                else if (date == DateTime.Today)
                {
                    // Still working — use current time
                    totalTimeHours = (decimal)(DateTime.Now - attForDay.ClockIn.Value).TotalHours;
                }
            }
            if (totalTimeHours < 0) totalTimeHours = 0;

            // Calculate break duration from employeebreaks
            decimal breakHours = 0;
            foreach (var b in breaksForDay)
            {
                breakHours += (decimal)(b.TotalBreakMinutes ?? 0) / 60.0m;
            }
            // Fallback to attendance breakhours column if no break records
            if (breakHours == 0 && attForDay != null && attForDay.BreakHours.HasValue)
            {
                breakHours = attForDay.BreakHours.Value;
            }

            // Effective work = totalTime - breakTime (NO penalty subtraction)
            decimal effectiveWork = Math.Max(0m, totalTimeHours - breakHours);

            // Calculate beforeBreak: time from clockin → first breakstart
            decimal beforeBreak = 0;
            if (attForDay != null && attForDay.ClockIn.HasValue)
            {
                var earliestBreak = breaksForDay.OrderBy(b => b.BreakStart).FirstOrDefault();
                if (earliestBreak != null)
                {
                    double beforeBreakDuration = (earliestBreak.BreakStart - attForDay.ClockIn.Value).TotalHours;
                    beforeBreak = Math.Max(0m, Math.Min(effectiveWork, (decimal)beforeBreakDuration));
                }
                else
                {
                    // No breaks taken — all effective work is "before break"
                    beforeBreak = effectiveWork;
                }
            }

            // afterBreak = remaining effective work after beforeBreak
            decimal afterBreak = Math.Max(0m, effectiveWork - beforeBreak);

            bool isWeekend = date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday;
            decimal expectedHours = (isWeekend || date < doj.Date) ? 0m : expectedHoursPerDay;
            decimal missing = Math.Max(0m, expectedHours - effectiveWork);

            dailyData[date] = new WorklogChartDto
            {
                Label = date.ToString("yyyy-MM-dd"),
                BeforeBreak = Math.Round(beforeBreak, 2),
                Break = Math.Round(breakHours, 2),
                AfterBreak = Math.Round(afterBreak, 2),
                Missing = Math.Round(missing, 2)
            };
        }

        if (range == "weekly")
        {
            var days = new[] { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };
            var resultList = new List<WorklogChartDto>();
            for (int i = 0; i < 7; i++)
            {
                var targetDate = startDate.AddDays(i);
                if (dailyData.TryGetValue(targetDate, out var dto))
                {
                    dto.Label = days[i];
                    resultList.Add(dto);
                }
                else
                {
                    resultList.Add(new WorklogChartDto { Label = days[i] });
                }
            }
            return resultList;
        }
        else if (range == "6months")
        {
            var resultList = new List<WorklogChartDto>();
            for (int i = 0; i < 6; i++)
            {
                var targetMonthStart = startDate.AddMonths(i);
                var monthName = targetMonthStart.ToString("MMM");

                decimal sumBeforeBreak = 0;
                decimal sumBreak = 0;
                decimal sumAfterBreak = 0;
                decimal sumMissing = 0;

                var daysInMonth = DateTime.DaysInMonth(targetMonthStart.Year, targetMonthStart.Month);
                for (int day = 1; day <= daysInMonth; day++)
                {
                    var date = new DateTime(targetMonthStart.Year, targetMonthStart.Month, day);
                    if (dailyData.TryGetValue(date, out var dto))
                    {
                        sumBeforeBreak += dto.BeforeBreak;
                        sumBreak += dto.Break;
                        sumAfterBreak += dto.AfterBreak;
                        sumMissing += dto.Missing;
                    }
                }

                resultList.Add(new WorklogChartDto
                {
                    Label = monthName,
                    BeforeBreak = Math.Round(sumBeforeBreak, 2),
                    Break = Math.Round(sumBreak, 2),
                    AfterBreak = Math.Round(sumAfterBreak, 2),
                    Missing = Math.Round(sumMissing, 2)
                });
            }
            return resultList;
        }
        else // monthly
        {
            var resultList = new List<WorklogChartDto>();
            for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
            {
                if (dailyData.TryGetValue(date, out var dto))
                {
                    dto.Label = date.Day.ToString();
                    resultList.Add(dto);
                }
                else
                {
                    resultList.Add(new WorklogChartDto { Label = date.Day.ToString() });
                }
            }
            return resultList;
        }
    }

    public async Task UpdateTaskStatusFromWorklogAsync(int taskId, string status)
    {
        if (string.IsNullOrWhiteSpace(status)) return;

        // Ensure status is valid
        if (status is not ("Pending" or "InProgress" or "Completed" or "Active" or "Resolve" or "Complete")) return;

        var sql = @"
            UPDATE t_projecttasks 
            SET taskstatus = @Status,
                completedat = CASE WHEN @Status IN ('Completed', 'Complete', 'Resolve') THEN NOW() ELSE NULL END
            WHERE taskid = @TaskId";
        await _db.ExecuteAsync(sql, new { Status = status, TaskId = taskId });
    }

    public async Task<IEnumerable<EmployeeDailyActivityRaw>> GetEmployeeDailyActivityRawAsync(int empId, DateTime from, DateTime to)
    {
        var sql = @"
            SELECT 
                a.empid AS EmpId,
                a.attendancedate::timestamp AS AttendanceDate,
                a.clockin AS ClockIn,
                a.clockout AS ClockOut,
                a.totalhours AS TotalHours,
                w.logid AS LogId,
                w.taskid AS TaskId,
                t.tasktitle AS TaskName,
                w.hoursworked AS HoursWorked,
                w.description AS Description
            FROM t_attendance a
            LEFT JOIN t_worklogs w 
                ON a.empid = w.empid
                AND a.attendancedate = w.workdate
            LEFT JOIN t_projecttasks t
                ON w.taskid = t.taskid
            WHERE a.empid = @EmpId
              AND a.attendancedate >= @From
              AND a.attendancedate <= @To
            ORDER BY a.attendancedate DESC, w.createdat DESC";

        return await _db.QueryAsync<EmployeeDailyActivityRaw>(sql, new { EmpId = empId, From = from.Date, To = to.Date });
    }

    public async Task<IEnumerable<ScreenshotDto>> GetEmployeeScreenshotsAsync(int empId, DateTime from, DateTime to)
    {
        var sql = @"
            SELECT 
                screenshotid AS ScreenshotId,
                fileurl AS FileUrl,
                capturedat AS CapturedAt
            FROM employee_screenshots
            WHERE empid = @EmpId
              AND capturedat >= @From
              AND capturedat < @ToPlusOne
            ORDER BY capturedat DESC";

        return await _db.QueryAsync<ScreenshotDto>(sql, new { EmpId = empId, From = from.Date, ToPlusOne = to.Date.AddDays(1) });
    }

    public async Task<decimal> GetExpectedWorkingHoursAsync(int empId)
    {
        var sql = @"
            SELECT COALESCE(s.workinghours, 8) 
            FROM t_spaces s
            INNER JOIN t_users u ON u.spaceid = s.spaceid
            WHERE u.empid = @EmpId";
        
        decimal expectedHours = await _db.ExecuteScalarAsync<decimal>(sql, new { EmpId = empId });
        return expectedHours <= 0 ? 8m : expectedHours;
    }
}
