namespace Backend.Services
{
    using System;
    using System.Collections.Generic;
    using System.Data;
    using System.Linq;
    using System.Text.Json;
    using System.Threading.Tasks;
    using Backend.Models;
    using Dapper;

    public interface IPerformanceService
    {
        Task<EmployeePerformance> GetOrCreatePerformanceAsync(int empId, int month, int year);
        Task<IEnumerable<EmployeePerformance>> GetSpacePerformanceAsync(int spaceId, int month, int year);
        Task<EmployeePerformance> RecalculatePerformanceAsync(int empId, int month, int year);
    }

    public class PerformanceService : IPerformanceService
    {
        private readonly IDbConnection _db;

        public PerformanceService(IDbConnection db)
        {
            _db = db;
        }

        public async Task<EmployeePerformance> GetOrCreatePerformanceAsync(int empId, int month, int year)
        {
            // Try to fetch existing record
            var selectSql = @"
                SELECT * FROM t_employee_performance 
                WHERE empid = @EmpId AND month = @Month AND year = @Year;";
            
            var existing = await _db.QueryFirstOrDefaultAsync<EmployeePerformance>(selectSql, new { EmpId = empId, Month = month, Year = year });
            if (existing != null)
            {
                return existing;
            }

            // Calculate and store new record
            return await RecalculatePerformanceAsync(empId, month, year);
        }

        public async Task<EmployeePerformance> RecalculatePerformanceAsync(int empId, int month, int year)
        {
            // 1. Fetch spaceid of employee
            var spaceId = await _db.ExecuteScalarAsync<int?>("SELECT spaceid FROM t_users WHERE empid = @EmpId", new { EmpId = empId }) ?? 0;

            // 2. Fetch completed & pending tasks
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
                    COALESCE(SUM(CASE WHEN taskstatus IN ('Completed', 'Complete', 'Resolve') OR actualhours >= estimatedhours THEN 1 ELSE 0 END), 0)::int AS completed,
                    COALESCE(SUM(CASE WHEN taskstatus NOT IN ('Completed', 'Complete', 'Resolve') AND actualhours < estimatedhours THEN 1 ELSE 0 END), 0)::int AS pending
                FROM task_stats;";

            var taskRow = await _db.QueryFirstOrDefaultAsync<dynamic>(taskSql, new { EmpId = empId });
            int tasksCompleted = taskRow?.completed ?? 0;
            int tasksPending = taskRow?.pending ?? 0;

            // 3. Fetch late minutes and early exit minutes
            var attStatsSql = @"
                SELECT 
                    COALESCE(SUM(lateminutes), 0) AS late_minutes,
                    COALESCE(SUM(earlyexitminutes), 0) AS early_exit_minutes
                FROM t_attendance 
                WHERE empid = @EmpId 
                  AND EXTRACT(MONTH FROM attendancedate) = @Month 
                  AND EXTRACT(YEAR FROM attendancedate) = @Year;";

            var attRow = await _db.QueryFirstOrDefaultAsync<dynamic>(attStatsSql, new { EmpId = empId, Month = month, Year = year });
            int lateMinutes = attRow?.late_minutes ?? 0;
            int earlyExitMinutes = attRow?.early_exit_minutes ?? 0;

            // 4. Fetch attendance score (percentage of days present out of total working days from DOJ)
            // Get employee DOJ
            var dojSql = "SELECT COALESCE(dateofjoining, CURRENT_DATE)::timestamp FROM t_users WHERE empid = @EmpId";
            var dojRaw = await _db.ExecuteScalarAsync(dojSql, new { EmpId = empId });
            DateTime empDoj = dojRaw != null ? Convert.ToDateTime(dojRaw) : DateTime.Today;
            if (empDoj == default) empDoj = DateTime.Today;

            // Get space working days configuration
            var wdSql = @"
                SELECT s.workingdays 
                FROM t_spaces s
                INNER JOIN t_users u ON u.spaceid = s.spaceid
                WHERE u.empid = @EmpId";
            var wdRaw = await _db.QueryFirstOrDefaultAsync<string>(wdSql, new { EmpId = empId });
            List<string> workingDaysList;
            if (!string.IsNullOrWhiteSpace(wdRaw))
            {
                try { workingDaysList = System.Text.Json.JsonSerializer.Deserialize<List<string>>(wdRaw) ?? new List<string> { "Mon","Tue","Wed","Thu","Fri" }; }
                catch { workingDaysList = new List<string> { "Mon","Tue","Wed","Thu","Fri" }; }
            }
            else workingDaysList = new List<string> { "Mon","Tue","Wed","Thu","Fri" };

            // Count attendance dates this month (excluding non-working days and status = 'Absent')
            var attDatesSql = @"
                SELECT DISTINCT DATE(attendancedate) AS adate, COALESCE(status, '') AS status
                FROM t_attendance 
                WHERE empid = @EmpId 
                  AND EXTRACT(MONTH FROM attendancedate) = @Month 
                  AND EXTRACT(YEAR FROM attendancedate) = @Year;";
            var attRows = await _db.QueryAsync<dynamic>(attDatesSql, new { EmpId = empId, Month = month, Year = year });
            int daysPresent = 0;
            foreach (var row in attRows)
            {
                if (row.adate != null)
                {
                    if (DateTime.TryParse(row.adate.ToString(), out DateTime adate))
                    {
                        string dayName = Backend.Models.Space.DayOfWeekToShortName(adate.DayOfWeek);
                        string status = row.status?.ToString() ?? "";
                        if (workingDaysList.Contains(dayName, StringComparer.OrdinalIgnoreCase) && !status.Equals("Absent", StringComparison.OrdinalIgnoreCase))
                        {
                            daysPresent++;
                        }
                    }
                }
            }

            // Count approved leaves this month
            var leaveCountSql = @"
                SELECT COUNT(*)
                FROM t_leaves 
                WHERE empid = @EmpId 
                  AND status = 'Approved'
                  AND EXTRACT(MONTH FROM leavedate) = @Month 
                  AND EXTRACT(YEAR FROM leavedate) = @Year";
            int approvedLeaves = await _db.ExecuteScalarAsync<int>(leaveCountSql, new { EmpId = empId, Month = month, Year = year });

            // Calculate total working days from DOJ (or month start) to today (or month end)
            var mStart = new DateTime(year, month, 1);
            var mEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
            if (mEnd > DateTime.Today) mEnd = DateTime.Today;
            if (mStart < empDoj.Date) mStart = empDoj.Date;

            int totalWorkingDays = 0;
            for (var d = mStart; d <= mEnd; d = d.AddDays(1))
            {
                string dayName = Backend.Models.Space.DayOfWeekToShortName(d.DayOfWeek);
                if (workingDaysList.Contains(dayName, StringComparer.OrdinalIgnoreCase))
                    totalWorkingDays++;
            }

            decimal attendanceScore = 0m;
            if (totalWorkingDays > 0)
            {
                attendanceScore = Math.Round((daysPresent + approvedLeaves) * 100.0m / totalWorkingDays, 1);
                if (attendanceScore > 100m) attendanceScore = 100m;
            }

            // 5. Calculate overall score
            // overall_score = (tasks_completed * 2) - (tasks_pending * 1.5) - (late_minutes * 0.2) - (early_exit_minutes * 0.2) + (attendance_score * 1.5)
            decimal overallScore = ((decimal)tasksCompleted * 2.0m)
                                   - ((decimal)tasksPending * 1.5m)
                                   - ((decimal)lateMinutes * 0.2m)
                                   - ((decimal)earlyExitMinutes * 0.2m)
                                   + (attendanceScore * 1.5m);

            // 6. Store / Upsert performance record
            var upsertSql = @"
                INSERT INTO t_employee_performance 
                    (empid, spaceid, month, year, tasks_completed, tasks_pending, late_minutes, early_exit_minutes, attendance_score, overall_score, createdat)
                VALUES 
                    (@EmpId, @SpaceId, @Month, @Year, @TasksCompleted, @TasksPending, @LateMinutes, @EarlyExitMinutes, @AttendanceScore, @OverallScore, CURRENT_TIMESTAMP)
                ON CONFLICT (empid, month, year) 
                DO UPDATE SET
                    tasks_completed = EXCLUDED.tasks_completed,
                    tasks_pending = EXCLUDED.tasks_pending,
                    late_minutes = EXCLUDED.late_minutes,
                    early_exit_minutes = EXCLUDED.early_exit_minutes,
                    attendance_score = EXCLUDED.attendance_score,
                    overall_score = EXCLUDED.overall_score,
                    createdat = CURRENT_TIMESTAMP
                RETURNING *;";

            return await _db.QueryFirstOrDefaultAsync<EmployeePerformance>(upsertSql, new
            {
                EmpId = empId,
                SpaceId = spaceId,
                Month = month,
                Year = year,
                TasksCompleted = tasksCompleted,
                TasksPending = tasksPending,
                LateMinutes = lateMinutes,
                EarlyExitMinutes = earlyExitMinutes,
                AttendanceScore = attendanceScore,
                OverallScore = overallScore
            });
        }

        public async Task<IEnumerable<EmployeePerformance>> GetSpacePerformanceAsync(int spaceId, int month, int year)
        {
            // Find all active employees/managers/TLs in the space
            var userSql = @"
                SELECT empid FROM t_users 
                WHERE spaceid = @SpaceId 
                  AND role != 'Admin' 
                  AND status = 'Active';";

            var empIds = (await _db.QueryAsync<int>(userSql, new { SpaceId = spaceId })).ToList();

            // Run / update calculations for all of them to guarantee up-to-date values
            foreach (var empId in empIds)
            {
                try
                {
                    await RecalculatePerformanceAsync(empId, month, year);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[PerformanceService] Error pre-calculating performance for employee {empId}: {ex.Message}");
                }
            }

            // Return all records for the space
            var selectSql = @"
                SELECT p.*, u.name as EmployeeName, u.email as EmployeeEmail, u.role as EmployeeRole 
                FROM t_employee_performance p
                INNER JOIN t_users u ON p.empid = u.empid
                WHERE p.spaceid = @SpaceId AND p.month = @Month AND p.year = @Year
                ORDER BY p.overall_score DESC;";

            var records = await _db.QueryAsync<dynamic>(selectSql, new { SpaceId = spaceId, Month = month, Year = year });
            
            // Map dynamic properties to strong performance list or just return mapped list
            return records.Select(r => new EmployeePerformance
            {
                PerformanceId = r.performanceid,
                EmpId = r.empid,
                SpaceId = r.spaceid,
                Month = r.month,
                Year = r.year,
                TasksCompleted = r.tasks_completed,
                TasksPending = r.tasks_pending,
                LateMinutes = r.late_minutes,
                EarlyExitMinutes = r.early_exit_minutes,
                AttendanceScore = r.attendance_score,
                OverallScore = r.overall_score,
                CreatedAt = r.createdat
            }).ToList();
        }
    }
}
