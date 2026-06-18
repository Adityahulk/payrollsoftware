namespace Backend.Repositories;

using System;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class AnalyticsRepository : IAnalyticsRepository
{
    private readonly IDbConnection _db;
    private readonly ISalaryRepository _salaryRepo;
    private readonly IAttendanceRepository _attendanceRepo;

    public AnalyticsRepository(IDbConnection db, ISalaryRepository salaryRepo, IAttendanceRepository attendanceRepo)
    {
        _db = db;
        _salaryRepo = salaryRepo;
        _attendanceRepo = attendanceRepo;
    }

    public async Task<ProductivityScore> GetProductivityAsync(int empId)
    {
        var dojQuery = "SELECT COALESCE(dateofjoining, CURRENT_DATE)::timestamp FROM t_users WHERE empid = @EmpId";
        var dojRaw = await _db.ExecuteScalarAsync(dojQuery, new { EmpId = empId });
        DateTime doj = dojRaw is DateOnly dojOnly 
            ? dojOnly.ToDateTime(TimeOnly.MinValue) 
            : (dojRaw != null ? Convert.ToDateTime(dojRaw) : DateTime.Today);

        // Calculate Working Days since DOJ using space working days
        var workingDays = await _attendanceRepo.GetWorkingDaysByEmpIdAsync(empId);
        int totalWorkingDays = 0;
        var start = doj.Date;
        var end = DateTime.Today;
        for (var d = start; d <= end; d = d.AddDays(1))
        {
            string dayName = Space.DayOfWeekToShortName(d.DayOfWeek);
            if (workingDays.Contains(dayName, StringComparer.OrdinalIgnoreCase))
                totalWorkingDays++;
        }
        if (totalWorkingDays == 0) totalWorkingDays = 1;

        // Attendance stats (only working days, excluding status = 'Absent')
        var isodowList = new List<int>();
        foreach (var wd in workingDays)
        {
            int dow = wd.ToLower() switch
            {
                "mon" => 1, "tue" => 2, "wed" => 3, "thu" => 4, "fri" => 5, "sat" => 6, "sun" => 7, _ => 0
            };
            if (dow > 0) isodowList.Add(dow);
        }

        var attSql = @"
            SELECT COUNT(DISTINCT DATE(attendancedate)) as presentDays, 
                   COALESCE(SUM(lateminutes), 0) as lateMinutes, 
                   COALESCE(SUM(earlyexitminutes), 0) as earlyExitMinutes 
            FROM t_attendance 
            WHERE empid = @EmpId
              AND COALESCE(status, '') != 'Absent'
              AND EXTRACT(ISODOW FROM attendancedate) = ANY(@Dows)";
        var attStats = await _db.QueryFirstOrDefaultAsync<dynamic>(attSql, new { EmpId = empId, Dows = isodowList.ToArray() });
        int presentDays = Convert.ToInt32(attStats?.presentdays ?? 0);
        int lateMinutes = Convert.ToInt32(attStats?.lateminutes ?? 0);
        int earlyExitMinutes = Convert.ToInt32(attStats?.earlyexitminutes ?? 0);
        
        int absentDays = Math.Max(0, totalWorkingDays - presentDays);

        // Auto Mark Leave: If approved leave exists on an absent day, reduce absent days.
        var leaveSql = @"
            SELECT COUNT(*) 
            FROM t_leaves 
            WHERE empid = @EmpId AND status = 'Approved' 
              AND leavedate >= @Start AND leavedate <= @End";
        var approvedLeaves = Convert.ToInt32(await _db.ExecuteScalarAsync(leaveSql, new { EmpId = empId, Start = doj.Date, End = DateTime.Today }) ?? 0);
        
        absentDays = Math.Max(0, absentDays - approvedLeaves);
        
        decimal attendanceScore = totalWorkingDays > 0 
            ? ((decimal)(presentDays - absentDays) / totalWorkingDays) * 100 
            : 100;
        if (attendanceScore < 0) attendanceScore = 0;
        if (attendanceScore > 100) attendanceScore = 100;

        // Work hours from attendance (clockout - clockin) minus breaks — NO t_worklogs
        var attendanceHoursSql = @"
            SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (a.clockout - a.clockin)) / 3600), 0)
            FROM t_attendance a
            WHERE a.empid = @EmpId AND a.clockout IS NOT NULL";
        decimal grossHours = Convert.ToDecimal(await _db.ExecuteScalarAsync(attendanceHoursSql, new { EmpId = empId }) ?? 0);

        var breakHoursSql = @"
            SELECT COALESCE(SUM(totalbreakminutes), 0) / 60.0
            FROM employeebreaks
            WHERE empid = @EmpId";
        decimal totalBreakHours = Convert.ToDecimal(await _db.ExecuteScalarAsync(breakHoursSql, new { EmpId = empId }) ?? 0);

        decimal actualWorkedHours = Math.Max(0m, grossHours - totalBreakHours);

        var times = await _attendanceRepo.GetSpaceWorkTimesAsync(empId);
        decimal spaceWorkingHours = times.WorkingHours.HasValue ? (decimal)times.WorkingHours.Value : 8m;
        
        decimal expectedHours = totalWorkingDays * spaceWorkingHours;
        decimal worklogScore = expectedHours > 0 
            ? (actualWorkedHours / expectedHours) * 100 
            : 100;
        if (worklogScore > 100) worklogScore = 100;

        // Task stats — including worklog hours to check completion
        var taskSql = @"
            WITH task_stats AS (
                SELECT 
                    t.taskid,
                    t.taskstatus,
                    COALESCE(t.estimatedhours, 8) AS estimatedhours,
                    COALESCE(SUM(w.hoursworked), 0) AS actualhours
                FROM t_projecttasks t
                LEFT JOIN t_worklogs w ON t.taskid = w.taskid AND w.empid = @EmpId
                WHERE t.assignedtoempid = @EmpId
                GROUP BY t.taskid, t.taskstatus, t.estimatedhours
            )
            SELECT 
                COUNT(*)::int AS totalTasksAssigned,
                SUM(CASE 
                    WHEN taskstatus IN ('Completed', 'Complete', 'Resolve') THEN 1
                    WHEN actualhours >= estimatedhours THEN 1
                    ELSE 0
                END)::int AS completedTasks
            FROM task_stats";
        var taskStats = await _db.QueryFirstOrDefaultAsync<dynamic>(taskSql, new { EmpId = empId });
        int totalTasks = Convert.ToInt32(taskStats?.totaltasksassigned ?? 0);
        int completedTasks = Convert.ToInt32(taskStats?.completedtasks ?? 0);

        decimal taskScore = totalTasks > 0 
            ? ((decimal)completedTasks / totalTasks) * 100 
            : 100; // default to 100 if no tasks assigned
        if (taskScore > 100) taskScore = 100;

        decimal totalScore = (attendanceScore * 0.3m) + (worklogScore * 0.4m) + (taskScore * 0.3m);

        return new ProductivityScore
        {
            AttendanceScore = Math.Round(attendanceScore, 2),
            WorklogScore = Math.Round(worklogScore, 2),
            TaskScore = Math.Round(taskScore, 2),
            TotalScore = Math.Round(totalScore, 2),
            LateMinutes = 0,
            EarlyExitMinutes = 0,
            TotalHours = actualWorkedHours,
            ExpectedHours = expectedHours
        };
    }

    public async Task<PayrollImpact> GetPayrollImpactAsync(int empId)
    {
        var salaryData = await _salaryRepo.GetSalaryAsync(empId, DateTime.UtcNow.Month, DateTime.UtcNow.Year);
        if (salaryData == null) return new PayrollImpact();

        // Get user's spaceId
        var userSql = @"SELECT spaceid FROM t_users WHERE empid = @EmpId";
        var spaceId = await _db.QueryFirstOrDefaultAsync<int?>(userSql, new { EmpId = empId });

        decimal breakTimeLimitHours = 1.0m;
        if (spaceId.HasValue && spaceId.Value > 0)
        {
            var breakSql = @"SELECT breaktime FROM t_spaces WHERE spaceid = @SpaceId";
            var breakTimeMinutes = await _db.QueryFirstOrDefaultAsync<int?>(breakSql, new { SpaceId = spaceId.Value });
            if (breakTimeMinutes.HasValue)
            {
                breakTimeLimitHours = breakTimeMinutes.Value / 60.0m;
            }
        }

        var dojQuery = "SELECT COALESCE(dateofjoining, CURRENT_DATE)::timestamp FROM t_users WHERE empid = @EmpId";
        var dojRaw = await _db.ExecuteScalarAsync(dojQuery, new { EmpId = empId });
        DateTime doj = dojRaw is DateOnly dojOnly 
            ? dojOnly.ToDateTime(TimeOnly.MinValue) 
            : (dojRaw != null ? Convert.ToDateTime(dojRaw) : DateTime.Today);

        int month = DateTime.UtcNow.Month;
        int year = DateTime.UtcNow.Year;
        var start = new DateTime(year, month, 1);
        if (doj > start) start = doj;
        var end = DateTime.Today;
        
        var attendanceSql = @"
            SELECT status, lateminutes, earlyexitminutes, breakhours, attendancedate::timestamp AS attendancedate 
            FROM t_attendance 
            WHERE empid = @EmpId 
              AND attendancedate >= @Start 
              AND attendancedate <= @End";
        var atts = await _db.QueryAsync<dynamic>(attendanceSql, new { EmpId = empId, Start = start.Date, End = end.Date });

        // Get working days for this employee
        var impactWorkingDays = await _attendanceRepo.GetWorkingDaysByEmpIdAsync(empId);

        int absentCount = 0;
        int lateCount = 0;
        int earlyExitCount = 0;
        int excessBreakCount = 0;

        foreach (var att in atts)
        {
            DateTime attDate = DateTime.MinValue;
            if (att.attendancedate != null)
            {
                attDate = att.attendancedate is DateOnly dOnly 
                    ? dOnly.ToDateTime(TimeOnly.MinValue) 
                    : Convert.ToDateTime(att.attendancedate);
            }
            string attDayName = Space.DayOfWeekToShortName(attDate.DayOfWeek);
            bool isWorkingDay = impactWorkingDays.Contains(attDayName, StringComparer.OrdinalIgnoreCase);

            if (isWorkingDay)
            {
                int lateMinutes = Convert.ToInt32(att.lateminutes ?? 0);
                if (lateMinutes > 5)
                {
                    lateCount++;
                }

                int earlyExitMinutes = Convert.ToInt32(att.earlyexitminutes ?? 0);
                if (earlyExitMinutes > 0)
                {
                    earlyExitCount++;
                }

                decimal breakHours = Convert.ToDecimal(att.breakhours ?? 0);
                if (breakHours > breakTimeLimitHours)
                {
                    excessBreakCount++;
                }
            }
        }

        // Dynamic absence calculation for current month
        {
            var attDatesSql = @"SELECT DATE(attendancedate)::timestamp FROM t_attendance 
                WHERE empid = @EmpId AND COALESCE(status, '') != 'Absent' AND attendancedate >= @Start AND attendancedate <= @End";
            var attDatesRaw = await _db.QueryAsync<DateTime?>(attDatesSql, new { EmpId = empId, Start = start.Date, End = end.Date });
            var attDatesSet = new HashSet<DateTime>((attDatesRaw ?? System.Linq.Enumerable.Empty<DateTime?>())
                .Where(d => d.HasValue)
                .Select(d => d.Value.Date));

            var leavesSql = @"SELECT leavedate::timestamp FROM t_leaves WHERE empid = @EmpId AND status = 'Approved'
                AND leavedate >= @Start AND leavedate <= @End";
            var leaveDatesRaw = await _db.QueryAsync<DateTime?>(leavesSql, new { EmpId = empId, Start = start.Date, End = end.Date });
            var leaveDatesSet = new HashSet<DateTime>((leaveDatesRaw ?? System.Linq.Enumerable.Empty<DateTime?>())
                .Where(d => d.HasValue)
                .Select(d => d.Value.Date));

            for (var d = start; d <= end; d = d.AddDays(1))
            {
                string dayName = Space.DayOfWeekToShortName(d.DayOfWeek);
                if (!impactWorkingDays.Contains(dayName, StringComparer.OrdinalIgnoreCase)) continue;
                if (attDatesSet.Contains(d.Date)) continue;
                if (leaveDatesSet.Contains(d.Date)) continue;
                absentCount++;
            }
        }

        var taskSql = @"
            WITH task_stats AS (
                SELECT 
                    t.taskid,
                    t.taskstatus,
                    COALESCE(t.estimatedhours, 8) AS estimatedhours,
                    COALESCE(SUM(w.hoursworked), 0) AS actualhours
                FROM t_projecttasks t
                LEFT JOIN t_worklogs w ON t.taskid = w.taskid AND w.empid = @EmpId
                WHERE t.assignedtoempid = @EmpId
                GROUP BY t.taskid, t.taskstatus, t.estimatedhours
            )
            SELECT COUNT(*)::int
            FROM task_stats
            WHERE taskstatus NOT IN ('Completed', 'Complete', 'Resolve')
              AND actualhours < estimatedhours";
        int pendingTaskCount = Convert.ToInt32(await _db.ExecuteScalarAsync(taskSql, new { EmpId = empId }) ?? 0);

        System.Collections.Generic.List<Deduction> spaceDeductions = new System.Collections.Generic.List<Deduction>();
        if (spaceId.HasValue && spaceId.Value > 0)
        {
            spaceDeductions = await PenaltyCalibrator.EnsurePenaltyDeductionsAsync(_db, spaceId.Value);
        }

        var calibratedRates = PenaltyCalibrator.GetCalibratedRates(salaryData.Basic, spaceDeductions);

        decimal absentPenalties = absentCount * calibratedRates.AbsentRate;
        decimal latePenalties = lateCount * calibratedRates.LateRate;
        decimal earlyExitPenalties = earlyExitCount * calibratedRates.EarlyExitRate;
        decimal breakPenalties = excessBreakCount * calibratedRates.ExcessBreakRate;
        decimal taskPenalties = pendingTaskCount * calibratedRates.PendingTaskRate;

        decimal totalPenalties = absentPenalties + latePenalties + earlyExitPenalties + breakPenalties + taskPenalties;

        decimal deductions = salaryData.Pf + salaryData.Tds;
        decimal baseSalary = salaryData.Basic;
        decimal gross = baseSalary + salaryData.Hra + salaryData.Da;
        decimal finalSalary = gross - deductions - totalPenalties;
        if (finalSalary < 0m) finalSalary = 0m;

        return new PayrollImpact
        {
            BaseSalary = salaryData.Basic,
            Deductions = deductions,
            LatePenalty = Math.Round(totalPenalties, 2),
            EarlyExitPenalty = Math.Round(earlyExitPenalties, 2),
            AdjustedSalary = Math.Round(finalSalary, 2),
            FinalSalary = Math.Round(finalSalary, 2)
        };
    }

    public async Task<PerformanceGrade> GetPerformanceGradeAsync(int empId)
    {
        var prod = await GetProductivityAsync(empId);
        var score = prod.TotalScore;
        string grade = "D";

        if (score >= 90) grade = "A+";
        else if (score >= 75) grade = "A";
        else if (score >= 60) grade = "B";
        else if (score >= 40) grade = "C";

        return new PerformanceGrade
        {
            ProductivityScore = score,
            Grade = grade
        };
    }
}
