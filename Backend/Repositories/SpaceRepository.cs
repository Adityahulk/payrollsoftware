namespace Backend.Repositories;

using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class SpaceRepository : ISpaceRepository
{
    private readonly IDbConnection _dbConnection;

    public SpaceRepository(IDbConnection dbConnection)
    {
        _dbConnection = dbConnection;
    }

    public async Task<IEnumerable<Space>> GetAllSpacesAsync()
    {
        var query = @"
            SELECT spaceid, spacename, adminid, numberofemployees, createdat, isactive, 
                   numberofbreaks, breaktime, workstarttime, workendtime, workinghours, 
                   type, enddate::timestamp as enddate, workingdays 
            FROM t_spaces 
            WHERE isactive = TRUE";
        return await _dbConnection.QueryAsync<Space>(query);
    }

    public async Task<Space?> GetSpaceByIdAsync(int spaceId)
    {
        var query = @"
            SELECT spaceid, spacename, adminid, numberofemployees, createdat, isactive, 
                   numberofbreaks, breaktime, workstarttime, workendtime, workinghours, 
                   type, enddate::timestamp as enddate, workingdays 
            FROM t_spaces 
            WHERE spaceid = @SpaceId AND isactive = TRUE";
        return await _dbConnection.QueryFirstOrDefaultAsync<Space>(query, new { SpaceId = spaceId });
    }

    public async Task<int> CreateSpaceAsync(Space space)
    {
        var query = @"
            INSERT INTO t_spaces (spacename, adminid, numberofemployees, numberofbreaks, breaktime, workstarttime, workendtime, workinghours, createdat, isactive, type, enddate, workingdays) 
            VALUES (@SpaceName, @AdminId, @NumberOfEmployees, @NumberOfBreaks, @BreakTime, @WorkStartTime, @WorkEndTime, @WorkingHours, @CreatedAt, @IsActive, @Type, @EndDate, @WorkingDays) 
            RETURNING spaceid;";
        return await _dbConnection.ExecuteScalarAsync<int>(query, new {
            space.SpaceName,
            space.AdminId,
            space.NumberOfEmployees,
            space.NumberOfBreaks,
            space.BreakTime,
            WorkStartTime = space.WorkStartTime.HasValue ? (TimeSpan?)space.WorkStartTime.Value.ToTimeSpan() : null,
            WorkEndTime = space.WorkEndTime.HasValue ? (TimeSpan?)space.WorkEndTime.Value.ToTimeSpan() : null,
            space.WorkingHours,
            space.CreatedAt,
            space.IsActive,
            space.Type,
            space.EndDate,
            space.WorkingDays
        });
    }

    public async Task<bool> UpdateSpaceAsync(Space space)
    {
        var query = @"
            UPDATE t_spaces 
            SET 
              spacename = @SpaceName,
              numberofemployees = @NumberOfEmployees,
              numberofbreaks = @NumberOfBreaks,
              breaktime = @BreakTime,
              workstarttime = @WorkStartTime,
              workendtime = @WorkEndTime,
              workinghours = @WorkingHours,
              type = @Type,
              enddate = @EndDate,
              workingdays = @WorkingDays
            WHERE spaceid = @SpaceId
            AND adminid = @AdminId AND isactive = TRUE";
        var result = await _dbConnection.ExecuteAsync(query, new {
            space.SpaceName,
            space.NumberOfEmployees,
            space.NumberOfBreaks,
            space.BreakTime,
            WorkStartTime = space.WorkStartTime.HasValue ? (TimeSpan?)space.WorkStartTime.Value.ToTimeSpan() : null,
            WorkEndTime = space.WorkEndTime.HasValue ? (TimeSpan?)space.WorkEndTime.Value.ToTimeSpan() : null,
            space.WorkingHours,
            space.Type,
            space.EndDate,
            space.WorkingDays,
            space.SpaceId,
            space.AdminId
        });
        return result > 0;
    }

    public async Task<bool> DeleteSpaceAsync(int spaceId)
    {
        return await SoftDeleteSpaceAsync(spaceId);
    }

    public async Task<IEnumerable<Space>> GetSpacesByAdminIdAsync(int adminId)
    {
        var query = @"
            SELECT 
                s.spaceid,
                s.spacename,
                s.adminid,
                s.numberofemployees,
                s.numberofbreaks,
                s.breaktime,
                s.workstarttime,
                s.workendtime,
                s.workinghours,
                s.createdat,
                s.isactive,
                s.type,
                s.enddate::timestamp as enddate,
                s.workingdays,
                COUNT(u.empid) as totalEmployees
            FROM t_spaces s
            LEFT JOIN t_users u ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId AND s.isactive = TRUE
            GROUP BY s.spaceid, s.spacename, s.adminid, s.numberofemployees, s.numberofbreaks, s.breaktime, s.workstarttime, s.workendtime, s.workinghours, s.createdat, s.isactive, s.type, s.enddate, s.workingdays
            ORDER BY s.spaceid;";
        return await _dbConnection.QueryAsync<Space>(query, new { AdminId = adminId });
    }

    public async Task<bool> SoftDeleteSpaceAsync(int spaceId)
    {
        var query = "UPDATE t_spaces SET isactive = FALSE WHERE spaceid = @SpaceId";
        var result = await _dbConnection.ExecuteAsync(query, new { SpaceId = spaceId });
        return result > 0;
    }

    // --- CONTRACT MANAGEMENT SYSTEM ---

    public async Task<IEnumerable<Space>> GetContractsByAdminIdAsync(int adminId)
    {
        var query = @"
            SELECT 
                s.spaceid,
                s.spacename,
                s.adminid,
                s.numberofemployees,
                s.numberofbreaks,
                s.breaktime,
                s.workstarttime,
                s.workendtime,
                s.workinghours,
                s.createdat,
                s.isactive,
                s.type,
                s.enddate::timestamp as enddate,
                s.workingdays,
                COUNT(u.empid) as totalEmployees
            FROM t_spaces s
            LEFT JOIN t_users u ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId AND s.isactive = TRUE AND s.type IN ('Contract', 'Completed')
            GROUP BY s.spaceid, s.spacename, s.adminid, s.numberofemployees, s.numberofbreaks, s.breaktime, s.workstarttime, s.workendtime, s.workinghours, s.createdat, s.isactive, s.type, s.enddate, s.workingdays
            ORDER BY s.spaceid;";
        return await _dbConnection.QueryAsync<Space>(query, new { AdminId = adminId });
    }

    public async Task<IEnumerable<Space>> GetDepartmentsByAdminIdAsync(int adminId)
    {
        var query = @"
            SELECT 
                s.spaceid,
                s.spacename,
                s.adminid,
                s.numberofemployees,
                s.numberofbreaks,
                s.breaktime,
                s.workstarttime,
                s.workendtime,
                s.workinghours,
                s.createdat,
                s.isactive,
                s.type,
                s.enddate::timestamp as enddate,
                s.workingdays,
                COUNT(u.empid) as totalEmployees
            FROM t_spaces s
            LEFT JOIN t_users u ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId AND s.isactive = TRUE AND s.type = 'Department'
            GROUP BY s.spaceid, s.spacename, s.adminid, s.numberofemployees, s.numberofbreaks, s.breaktime, s.workstarttime, s.workendtime, s.workinghours, s.createdat, s.isactive, s.type, s.enddate, s.workingdays
            ORDER BY s.spaceid;";
        return await _dbConnection.QueryAsync<Space>(query, new { AdminId = adminId });
    }

    public async Task<ContractPayment?> GetPaymentBySpaceIdAsync(int spaceId)
    {
        var query = "SELECT * FROM t_contractpayments WHERE spaceid = @SpaceId ORDER BY paymentid DESC LIMIT 1;";
        return await _dbConnection.QueryFirstOrDefaultAsync<ContractPayment>(query, new { SpaceId = spaceId });
    }

    public async Task<int> CreatePaymentAsync(ContractPayment payment)
    {
        var query = @"
            INSERT INTO t_contractpayments (spaceid, amount, paymentmethod, status, transactionid, paidat, createdat)
            VALUES (@SpaceId, @Amount, @PaymentMethod, @Status, @TransactionId, @PaidAt, @CreatedAt)
            RETURNING paymentid;";
        return await _dbConnection.ExecuteScalarAsync<int>(query, payment);
    }

    public async Task<bool> UpdatePaymentStatusAsync(int spaceId, string status, string? transactionId, string method)
    {
        var checkQuery = "SELECT paymentid FROM t_contractpayments WHERE spaceid = @SpaceId ORDER BY paymentid DESC LIMIT 1;";
        var paymentId = await _dbConnection.QueryFirstOrDefaultAsync<int?>(checkQuery, new { SpaceId = spaceId });

        if (paymentId == null || paymentId == 0)
        {
            var insQuery = @"
                INSERT INTO t_contractpayments (spaceid, amount, paymentmethod, status, transactionid, paidat, createdat)
                VALUES (@SpaceId, 0, @PaymentMethod, @Status, @TransactionId, @PaidAt, NOW());";
            var insResult = await _dbConnection.ExecuteAsync(insQuery, new { 
                SpaceId = spaceId, 
                PaymentMethod = method, 
                Status = status, 
                TransactionId = transactionId, 
                PaidAt = (status == "Paid" ? DateTime.UtcNow : (DateTime?)null) 
            });
            return insResult > 0;
        }
        else
        {
            var query = @"
                UPDATE t_contractpayments
                SET status = @Status,
                    transactionid = @TransactionId,
                    paymentmethod = @PaymentMethod,
                    paidat = @PaidAt
                WHERE paymentid = @PaymentId;";
            var result = await _dbConnection.ExecuteAsync(query, new {
                Status = status,
                TransactionId = transactionId,
                PaymentMethod = method,
                PaidAt = (status == "Paid" ? DateTime.UtcNow : (DateTime?)null),
                PaymentId = paymentId
            });
            return result > 0;
        }
    }

    public async Task<bool> GeneratePayslipsAsync(int spaceId, int paymentId, decimal amount)
    {
        var empQuery = "SELECT empid FROM t_users WHERE spaceid = @SpaceId;";
        var emps = await _dbConnection.QueryAsync<int>(empQuery, new { SpaceId = spaceId });
        var empList = emps.AsList();
        
        if (empList.Count == 0) return true;

        decimal share = Math.Round(amount / empList.Count, 2);

        var insertSlip = @"
            INSERT INTO t_payslips (empid, spaceid, baseamount, deduction, finalamount, type, paymentid, generatedat)
            VALUES (@EmpId, @SpaceId, @BaseAmount, @Deduction, @FinalAmount, 'Contract', @PaymentId, NOW());";

        foreach (var empId in empList)
        {
            await _dbConnection.ExecuteAsync(insertSlip, new {
                EmpId = empId,
                SpaceId = spaceId,
                BaseAmount = share,
                Deduction = 0m,
                FinalAmount = share,
                PaymentId = paymentId
            });
        }
        return true;
    }

    public async Task<IEnumerable<dynamic>> GetPayslipsBySpaceIdAsync(int spaceId)
    {
        var query = @"
            SELECT p.*, u.name, u.email 
            FROM t_payslips p
            JOIN t_users u ON p.empid = u.empid
            WHERE p.spaceid = @SpaceId
            ORDER BY p.slipid DESC;";
        return await _dbConnection.QueryAsync<dynamic>(query, new { SpaceId = spaceId });
    }

    public async Task<bool> CheckAndUpdateContractExpiryAsync(int spaceId)
    {
        var checkQuery = "SELECT enddate::timestamp as enddate, type FROM t_spaces WHERE spaceid = @SpaceId;";
        var space = await _dbConnection.QueryFirstOrDefaultAsync<Space>(checkQuery, new { SpaceId = spaceId });
        if (space != null && space.EndDate != null && space.Type == "Contract")
        {
            DateTime endDate = space.EndDate.Value;
            if (DateTime.Today >= endDate.Date)
            {
                var updateQuery = "UPDATE t_spaces SET type = 'Completed' WHERE spaceid = @SpaceId;";
                var result = await _dbConnection.ExecuteAsync(updateQuery, new { SpaceId = spaceId });
                return result > 0;
            }
        }
        return false;
    }

    // --- PERFORMANCE-BASED PAYROLL SYSTEM ---

    public async Task<dynamic> GetSpacePayrollSummaryAsync(int spaceId)
    {
        try
        {
            var workforceQuery = "SELECT COUNT(*) FROM t_users WHERE spaceid = @SpaceId AND role != 'Admin';";
            var workforceRaw = await _dbConnection.ExecuteScalarAsync(workforceQuery, new { SpaceId = spaceId });
            int workforceCount = Convert.ToInt32(workforceRaw ?? 0);

            var spaceNameQuery = "SELECT spacename FROM t_spaces WHERE spaceid = @SpaceId;";
            string spaceName = await _dbConnection.ExecuteScalarAsync<string>(spaceNameQuery, new { SpaceId = spaceId }) ?? "Unknown Space";

            var hoursQuery = @"
                SELECT COALESCE(SUM(wl.hoursworked), 0)
                FROM t_worklogs wl
                JOIN t_users u ON wl.empid = u.empid
                WHERE u.spaceid = @SpaceId;";
            var hoursRaw = await _dbConnection.ExecuteScalarAsync(hoursQuery, new { SpaceId = spaceId });
            decimal totalHoursWorked = Convert.ToDecimal(hoursRaw ?? 0m);

            var attQuery = @"
                SELECT 
                    COUNT(*) FILTER (WHERE a.status = 'Present') as present,
                    COUNT(*) FILTER (WHERE a.status = 'Absent') as absent
                FROM t_attendance a
                JOIN t_users u ON a.empid = u.empid
                WHERE u.spaceid = @SpaceId;";
            var attStats = await _dbConnection.QueryFirstOrDefaultAsync(attQuery, new { SpaceId = spaceId });
            int totalPresent = attStats != null ? Convert.ToInt32(attStats.present ?? 0) : 0;
            int totalAbsent = attStats != null ? Convert.ToInt32(attStats.absent ?? 0) : 0;

            var tasksQuery = @"
                SELECT 
                    COUNT(*) FILTER (WHERE taskstatus IN ('Completed', 'Complete', 'Resolve')) as completed,
                    COUNT(*) FILTER (WHERE taskstatus NOT IN ('Completed', 'Complete', 'Resolve')) as pending
                FROM t_projecttasks t
                JOIN t_users u ON t.assignedtoempid = u.empid
                WHERE u.spaceid = @SpaceId;";
            var taskStats = await _dbConnection.QueryFirstOrDefaultAsync(tasksQuery, new { SpaceId = spaceId });
            int completedTasks = taskStats != null ? Convert.ToInt32(taskStats.completed ?? 0) : 0;
            int pendingTasks = taskStats != null ? Convert.ToInt32(taskStats.pending ?? 0) : 0;

            // Total approved leaves — leave ≠ absent in metrics
            var leaveCountRaw = await _dbConnection.ExecuteScalarAsync(
                "SELECT COUNT(*) FROM t_leaves WHERE spaceid = @SpaceId AND status = 'Approved'",
                new { SpaceId = spaceId });
            int totalLeave = Convert.ToInt32(leaveCountRaw ?? 0);

            return new {
                SpaceId = spaceId,
                SpaceName = spaceName,
                WorkforceCount = workforceCount,
                TotalHoursWorked = totalHoursWorked,
                TotalPresent = totalPresent,
                TotalAbsent = totalAbsent,
                TotalLeave = totalLeave,
                CompletedTasks = completedTasks,
                PendingTasks = pendingTasks
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine("PAYROLL REPO ERROR:");
            Console.WriteLine(ex.ToString());

            return new {
                completeProfiles = new List<object>(),
                incompleteProfiles = new List<object>(),
                totalPayout = 0,
                totalDeductions = 0
            };
        }
    }

    public async Task<IEnumerable<dynamic>> GetSpaceEmployeePayrollEvaluationsAsync(int spaceId, bool applyPenalties = true, int? month = null, int? year = null)
    {
        Console.WriteLine("START PAYROLL (Optimized - No N+1)");
        Console.WriteLine("SpaceId: " + spaceId);

        int targetMonth = month ?? DateTime.UtcNow.Month;
        int targetYear = year ?? DateTime.UtcNow.Year;

        // 1. Fetch the space config
        var space = await GetSpaceByIdAsync(spaceId);
        decimal breakTimeLimitHours = 1.0m; // fallback 60 minutes
        if (space != null && space.BreakTime.HasValue)
        {
            breakTimeLimitHours = space.BreakTime.Value / 60.0m;
        }

        // Get working days for off-day aware calculations: safe JSON parsing
        var workingDaysList = new List<string>();
        if (space != null && !string.IsNullOrEmpty(space.WorkingDays))
        {
            try
            {
                workingDaysList = System.Text.Json.JsonSerializer.Deserialize<List<string>>(space.WorkingDays) ?? new List<string>();
            }
            catch
            {
                workingDaysList = new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri" };
            }
        }
        else
        {
            workingDaysList = new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri" };
        }

        // 2. Fetch active employees (excluding Admin) — ORDER BY empid DESC
        var employees = await _dbConnection.QueryAsync<dynamic>(
            "SELECT empid, name, email, role, accountnumber, bankname, accountholdername, ifsccode, upiid FROM t_users WHERE spaceid = @SpaceId AND role != 'Admin' ORDER BY empid DESC;",
            new { SpaceId = spaceId });
        var employeesList = (employees ?? System.Linq.Enumerable.Empty<dynamic>()).ToList();
        Console.WriteLine("Employees Count: " + employeesList.Count);

        if (employeesList.Count == 0) return new List<dynamic>();

        // 3. Fetch basic salaries
        var salaryRows = await _dbConnection.QueryAsync<dynamic>(
            "SELECT empid, basic FROM t_employeesalary WHERE spaceid = @SpaceId;",
            new { SpaceId = spaceId });
        var salaryDict = new Dictionary<int, decimal>();
        foreach (var s in salaryRows)
        {
            salaryDict[Convert.ToInt32(s.empid)] = Convert.ToDecimal(s.basic);
        }

        // 4. Fetch allowances
        var allowances = await GetAllowancesBySpaceIdAsync(spaceId);

        // 5. Fetch deductions
        var deductions = await GetDeductionsBySpaceIdAsync(spaceId);

        // 6. Fetch attendance records (filtered by target month/year)
        var attendanceRecords = await _dbConnection.QueryAsync<dynamic>(
            @"SELECT a.empid, a.status, a.lateminutes, a.earlyexitminutes, a.breakhours, a.attendancedate 
              FROM t_attendance a 
              JOIN t_users u ON a.empid = u.empid 
              WHERE u.spaceid = @SpaceId
                AND EXTRACT(MONTH FROM a.attendancedate) = @Month
                AND EXTRACT(YEAR FROM a.attendancedate) = @Year;",
            new { SpaceId = spaceId, Month = targetMonth, Year = targetYear });
        var attendanceGroup = (attendanceRecords ?? System.Linq.Enumerable.Empty<dynamic>())
            .GroupBy(a => Convert.ToInt32(a.empid))
            .ToDictionary(g => g.Key, g => g.ToList());

        // 7. Fetch tasks
        var taskRecords = await _dbConnection.QueryAsync<dynamic>(
            @"SELECT t.assignedtoempid as empid, t.taskstatus 
              FROM t_projecttasks t 
              JOIN t_users u ON t.assignedtoempid = u.empid 
              WHERE u.spaceid = @SpaceId;",
            new { SpaceId = spaceId });
        var taskGroup = (taskRecords ?? System.Linq.Enumerable.Empty<dynamic>())
            .GroupBy(t => Convert.ToInt32(t.empid))
            .ToDictionary(g => g.Key, g => g.ToList());

        // 8. Fetch payments already processed for the space in target month/year
        var payments = await _dbConnection.QueryAsync<dynamic>(
            @"SELECT empid, status 
              FROM t_payrollpayments 
              WHERE spaceid = @SpaceId
                AND EXTRACT(MONTH FROM createdat) = @Month
                AND EXTRACT(YEAR FROM createdat) = @Year;",
            new { SpaceId = spaceId, Month = targetMonth, Year = targetYear });
        var paymentStatusDict = new Dictionary<int, string>();
        foreach (var p in payments)
        {
            paymentStatusDict[Convert.ToInt32(p.empid)] = p.status?.ToString() ?? "Pending";
        }

        // ─── BULK PRE-FETCH: DOJ, Attendance Dates, Leave Dates (Eliminates N+1) ───
        
        // 9. Bulk-fetch DOJ for all employees in this space
        var dojRows = await _dbConnection.QueryAsync<dynamic>(
            @"SELECT empid, COALESCE(dateofjoining, CURRENT_DATE)::timestamp AS doj
              FROM t_users
              WHERE spaceid = @SpaceId AND role != 'Admin';",
            new { SpaceId = spaceId });
        var dojDict = new Dictionary<int, DateTime>();
        foreach (var row in dojRows)
        {
            int eid = 0;
            if (row.empid != null && int.TryParse(row.empid.ToString(), out eid) && eid > 0)
            {
                DateTime parsed = DateTime.MinValue;
                if (row.doj != null && DateTime.TryParse(row.doj.ToString(), out parsed))
                    dojDict[eid] = parsed;
            }
        }

        // 10. Bulk-fetch presence dates for target month
        var attDateRows = await _dbConnection.QueryAsync<dynamic>(
            @"SELECT a.empid, DATE(a.attendancedate)::timestamp AS adate
              FROM t_attendance a
              JOIN t_users u ON a.empid = u.empid
              WHERE u.spaceid = @SpaceId
                AND COALESCE(a.status, '') != 'Absent'
                AND EXTRACT(MONTH FROM a.attendancedate) = @Month
                AND EXTRACT(YEAR FROM a.attendancedate) = @Year;",
            new { SpaceId = spaceId, Month = targetMonth, Year = targetYear });
        var attDatesDict = new Dictionary<int, HashSet<DateTime>>();
        foreach (var row in attDateRows)
        {
            int eid = 0;
            if (row.empid == null || !int.TryParse(row.empid.ToString(), out eid) || eid <= 0) continue;
            DateTime parsed = DateTime.MinValue;
            if (row.adate != null && DateTime.TryParse(row.adate.ToString(), out parsed))
            {
                if (!attDatesDict.ContainsKey(eid)) attDatesDict[eid] = new HashSet<DateTime>();
                attDatesDict[eid].Add(parsed.Date);
            }
        }

        // 11. Bulk-fetch approved leave dates for target month
        var leaveDateRows = await _dbConnection.QueryAsync<dynamic>(
            @"SELECT l.empid, l.leavedate::timestamp AS ldate
              FROM t_leaves l
              JOIN t_users u ON l.empid = u.empid
              WHERE u.spaceid = @SpaceId
                AND l.status = 'Approved'
                AND EXTRACT(MONTH FROM l.leavedate) = @Month
                AND EXTRACT(YEAR FROM l.leavedate) = @Year;",
            new { SpaceId = spaceId, Month = targetMonth, Year = targetYear });
        var leaveDatesDict = new Dictionary<int, HashSet<DateTime>>();
        foreach (var row in leaveDateRows)
        {
            int eid = 0;
            if (row.empid == null || !int.TryParse(row.empid.ToString(), out eid) || eid <= 0) continue;
            DateTime parsed = DateTime.MinValue;
            if (row.ldate != null && DateTime.TryParse(row.ldate.ToString(), out parsed))
            {
                if (!leaveDatesDict.ContainsKey(eid)) leaveDatesDict[eid] = new HashSet<DateTime>();
                leaveDatesDict[eid].Add(parsed.Date);
            }
        }

        // Bulk-fetch holidays for this space in the target month/year
        var holidayRows = await _dbConnection.QueryAsync<dynamic>(
            @"SELECT holidaydate::timestamp AS hdate
              FROM t_holidays
              WHERE spaceid = @SpaceId
                AND EXTRACT(MONTH FROM holidaydate) = @Month
                AND EXTRACT(YEAR FROM holidaydate) = @Year;",
            new { SpaceId = spaceId, Month = targetMonth, Year = targetYear });
        var spaceHolidays = new HashSet<DateTime>();
        foreach (var h in holidayRows ?? Enumerable.Empty<dynamic>())
        {
            if (h.hdate != null)
            {
                DateTime parsedDate;
                if (DateTime.TryParse(h.hdate.ToString(), out parsedDate))
                {
                    spaceHolidays.Add(parsedDate.Date);
                }
            }
        }

        Console.WriteLine($"[Payroll] Bulk data fetched. Employees: {employeesList.Count}, DOJs: {dojDict.Count}, AttDates: {attDatesDict.Count}, LeaveDates: {leaveDatesDict.Count}, Holidays: {spaceHolidays.Count}");

        var results = new List<dynamic>();

        foreach (var emp in employeesList)
        {
            int empId = 0;
            string name = "Unknown";
            string email = "";
            string role = "Employee";
            try
            {
                int.TryParse(emp.empid?.ToString(), out empId);
                name = emp.name?.ToString() ?? "Unknown";
                email = emp.email?.ToString() ?? "";
                role = emp.role?.ToString() ?? "Employee";

                decimal basicSalary = 25000m;
                bool salaryConfigured = salaryDict.TryGetValue(empId, out decimal customBasic);
                if (salaryConfigured && customBasic > 0)
                {
                    basicSalary = customBasic;
                }

                var allowanceList = new List<dynamic>();
                decimal totalAllowances = 0m;
                foreach (var allowance in allowances)
                {
                    decimal amt = allowance.Type == "Percentage" 
                        ? Math.Round(basicSalary * allowance.Value / 100m, 2) 
                        : allowance.Value;
                    totalAllowances += amt;
                    allowanceList.Add(new {
                        Name = allowance.Name,
                        Type = allowance.Type,
                        Value = allowance.Value,
                        Amount = amt
                    });
                }

                if (!salaryConfigured && allowanceList.Count == 0)
                {
                    allowanceList.Add(new { Name = "HRA", Type = "Fixed", Value = 10000m, Amount = 10000m });
                    allowanceList.Add(new { Name = "DA", Type = "Fixed", Value = 3000m, Amount = 3000m });
                    totalAllowances = 13000m;
                }

                var calibratedRates = PenaltyCalibrator.GetCalibratedRates(basicSalary, deductions);

                var absentDed   = deductions.FirstOrDefault(d => d.DeductionType == "Absent"       || d.Name.Contains("absent",  StringComparison.OrdinalIgnoreCase) || d.Name.Contains("absence",  StringComparison.OrdinalIgnoreCase));
                var lateDed     = deductions.FirstOrDefault(d => d.DeductionType == "Late"          || d.Name.Contains("late",    StringComparison.OrdinalIgnoreCase));
                var earlyExitDed= deductions.FirstOrDefault(d => d.DeductionType == "Early Exit"    || d.Name.Contains("early",   StringComparison.OrdinalIgnoreCase));
                var breakDed    = deductions.FirstOrDefault(d => d.DeductionType == "Excess Break"  || d.Name.Contains("break",   StringComparison.OrdinalIgnoreCase));
                var taskDed     = deductions.FirstOrDefault(d => d.DeductionType == "Pending Tasks" || d.Name.Contains("task",    StringComparison.OrdinalIgnoreCase) || d.Name.Contains("pending", StringComparison.OrdinalIgnoreCase));

                var deductionList = new List<dynamic>();
                decimal totalDeductions = 0m;
                foreach (var deduction in deductions)
                {
                    if (calibratedRates.PenaltyDeductionIds.Contains(deduction.DeductionId)) continue;

                    decimal amt = deduction.Type == "Percentage" 
                        ? Math.Round(basicSalary * deduction.Value / 100m, 2) 
                        : deduction.Value;
                    totalDeductions += amt;
                    deductionList.Add(new {
                        Name = deduction.Name,
                        Type = deduction.Type,
                        Value = deduction.Value,
                        Amount = amt,
                        DeductionType = deduction.DeductionType ?? "Standard"
                    });
                }

                int lateCount = 0, earlyExitCount = 0, excessBreakCount = 0;
                var atts = attendanceGroup.TryGetValue(empId, out var foundAtts) ? foundAtts : new List<dynamic>();

                foreach (var att in atts)
                {
                    if (att.attendancedate == null) continue;
                    if (!DateTime.TryParse(att.attendancedate.ToString(), out DateTime attDate)) continue;

                    string attDayName = Models.Space.DayOfWeekToShortName(attDate.DayOfWeek);
                    if (!workingDaysList.Contains(attDayName, StringComparer.OrdinalIgnoreCase)) continue;

                    int lateMinutes = 0;
                    int.TryParse(att.lateminutes?.ToString(), out lateMinutes);
                    if (lateMinutes > 5) lateCount++;

                    int earlyExitMinutes = 0;
                    int.TryParse(att.earlyexitminutes?.ToString(), out earlyExitMinutes);
                    if (earlyExitMinutes > 0) earlyExitCount++;

                    decimal breakHoursVal = 0m;
                    decimal.TryParse(att.breakhours?.ToString(), out breakHoursVal);
                    if (breakHoursVal > breakTimeLimitHours) excessBreakCount++;
                }

                int absentCount = 0;
                {
                    DateTime empDoj = dojDict.TryGetValue(empId, out DateTime fetchedDoj) ? fetchedDoj : DateTime.Today;
                    var attDatesSet  = attDatesDict.TryGetValue(empId,   out var fAtt)   ? fAtt   : new HashSet<DateTime>();
                    var leaveDatesSet= leaveDatesDict.TryGetValue(empId, out var fLeave) ? fLeave : new HashSet<DateTime>();

                    var monthStart = new DateTime(targetYear, targetMonth, 1);
                    var monthEnd   = new DateTime(targetYear, targetMonth, DateTime.DaysInMonth(targetYear, targetMonth));
                    if (monthEnd > DateTime.Today) monthEnd = DateTime.Today;
                    if (monthStart < empDoj.Date)  monthStart = empDoj.Date;

                    for (var d = monthStart; d <= monthEnd; d = d.AddDays(1))
                    {
                        string dayName = Models.Space.DayOfWeekToShortName(d.DayOfWeek);
                        if (!workingDaysList.Contains(dayName, StringComparer.OrdinalIgnoreCase)) continue;
                        if (attDatesSet.Contains(d.Date))   continue;
                        if (leaveDatesSet.Contains(d.Date)) continue;
                        if (spaceHolidays.Contains(d.Date)) continue;
                        absentCount++;
                    }
                }

                int pendingTaskCount = 0;
                var tasks = taskGroup.TryGetValue(empId, out var foundTasks) ? foundTasks : new List<dynamic>();
                foreach (var task in tasks)
                {
                    string tstatus = task.taskstatus?.ToString() ?? "";
                    if (!tstatus.Equals("Completed", StringComparison.OrdinalIgnoreCase) &&
                        !tstatus.Equals("Complete",  StringComparison.OrdinalIgnoreCase) &&
                        !tstatus.Equals("Resolve",   StringComparison.OrdinalIgnoreCase))
                    {
                        pendingTaskCount++;
                    }
                }

                decimal totalPerformanceDeduction = 0m;

                void ProcessPenalty(Deduction? customDed, string defaultName, decimal defaultValue, int occurrences, decimal rate, string penaltyType)
                {
                    decimal amt = applyPenalties ? (occurrences * rate) : 0m;
                    if (amt <= 0m) return;

                    string pName = customDed != null ? customDed.Name : defaultName;
                    string pType = customDed != null ? customDed.Type : "Fixed";
                    decimal pVal = customDed != null ? customDed.Value : defaultValue;

                    string rateText = pType.Equals("Percentage", StringComparison.OrdinalIgnoreCase)
                        ? $"{pVal:0.##}% of Basic"
                        : $"₹{pVal:0.##}";

                    string unitLabel = penaltyType switch
                    {
                        "Absent"       => occurrences == 1 ? "absence"       : "absences",
                        "Late"         => occurrences == 1 ? "late clock-in"  : "late clock-ins",
                        "Early Exit"   => occurrences == 1 ? "early exit"     : "early exits",
                        "Excess Break" => occurrences == 1 ? "excess break"   : "excess breaks",
                        "Pending Tasks"=> occurrences == 1 ? "pending task"   : "pending tasks",
                        _              => occurrences == 1 ? "occurrence"     : "occurrences"
                    };

                    deductionList.Add(new {
                        Name = $"{pName} ({occurrences} {unitLabel}, {rateText} each)",
                        Type = pType, Value = pVal, Amount = amt, DeductionType = penaltyType
                    });
                    totalDeductions += amt;
                    totalPerformanceDeduction += amt;
                }

                ProcessPenalty(absentDed,   "Absent Penalty",        1000m, absentCount,      calibratedRates.AbsentRate,      "Absent");
                ProcessPenalty(lateDed,     "Late Clock-In Penalty",  200m, lateCount,         calibratedRates.LateRate,        "Late");
                ProcessPenalty(earlyExitDed,"Early Exit Penalty",     200m, earlyExitCount,    calibratedRates.EarlyExitRate,   "Early Exit");
                ProcessPenalty(breakDed,    "Excess Break Penalty",   150m, excessBreakCount,  calibratedRates.ExcessBreakRate, "Excess Break");
                ProcessPenalty(taskDed,     "Pending Tasks Penalty",  500m, pendingTaskCount,  calibratedRates.PendingTaskRate, "Pending Tasks");

                var incompleteReasons = new List<string>();
                if (absentCount > 0)
                    incompleteReasons.Add($"{absentCount} absence(s) registered: ₹{(absentCount * calibratedRates.AbsentRate):0.##}");
                if (lateCount > 0)
                    incompleteReasons.Add($"{lateCount} late clock-in(s) (> 5 mins): ₹{(lateCount * calibratedRates.LateRate):0.##}");
                if (earlyExitCount > 0)
                    incompleteReasons.Add($"{earlyExitCount} early exit(s): ₹{(earlyExitCount * calibratedRates.EarlyExitRate):0.##}");
                if (excessBreakCount > 0)
                    incompleteReasons.Add($"{excessBreakCount} excess break duration incident(s): ₹{(excessBreakCount * calibratedRates.ExcessBreakRate):0.##}");
                if (pendingTaskCount > 0)
                    incompleteReasons.Add($"{pendingTaskCount} pending task(s) in queue: ₹{(pendingTaskCount * calibratedRates.PendingTaskRate):0.##}");
                if (!salaryConfigured)
                    incompleteReasons.Add($"Salary not configured (using default ₹{basicSalary:0.##})");

                string profileStatus = (absentCount > 0 || lateCount > 0 || earlyExitCount > 0 ||
                                        excessBreakCount > 0 || pendingTaskCount > 0 || !salaryConfigured)
                    ? "Incomplete" : "Complete";

                decimal finalAmount = Math.Max(0m, basicSalary + totalAllowances - totalDeductions);

                string paymentStatus = paymentStatusDict.TryGetValue(empId, out string pStatus) ? pStatus : "Pending";

                results.Add(new {
                    EmpId = empId,
                    Name = name,
                    Email = email,
                    Role = role,
                    Basic = basicSalary,
                    TotalAllowances = totalAllowances,
                    TotalDeductions = totalDeductions,
                    PerformancePenalties = totalPerformanceDeduction,
                    TotalPerformanceDeduction = totalPerformanceDeduction,
                    FinalAmount = finalAmount,
                    NetSalary = basicSalary + totalAllowances - (totalDeductions - totalPerformanceDeduction),
                    ProfileStatus = profileStatus,
                    IncompleteReasons = incompleteReasons,
                    PaymentStatus = paymentStatus,
                    Allowances = allowanceList,
                    Deductions = deductionList,
                    AccountNumber = emp.accountnumber?.ToString(),
                    BankName = emp.bankname?.ToString(),
                    AccountHolderName = emp.accountholdername?.ToString(),
                    IfscCode = emp.ifsccode?.ToString(),
                    UpiId = emp.upiid?.ToString()
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("EMP ERROR: " + empId);
                Console.WriteLine(ex.ToString());
                int fallbackId = 0;
                int.TryParse(emp.empid?.ToString(), out fallbackId);

                results.Add(new {
                    EmpId = empId > 0 ? empId : fallbackId,
                    Name = name,
                    Email = email,
                    Role = role,
                    Basic = 25000m,
                    TotalAllowances = 13000m,
                    TotalDeductions = 0m,
                    PerformancePenalties = 0m,
                    TotalPerformanceDeduction = 0m,
                    FinalAmount = 38000m,
                    NetSalary = 38000m,
                    ProfileStatus = "Incomplete",
                    IncompleteReasons = new List<string> { "System Error" },
                    PaymentStatus = "Pending",
                    Allowances = new List<dynamic> {
                        new { Name = "HRA", Type = "Fixed", Value = 10000m, Amount = 10000m },
                        new { Name = "DA",  Type = "Fixed", Value = 3000m,  Amount = 3000m  }
                    },
                    Deductions = new List<dynamic>(),
                    AccountNumber = emp.accountnumber?.ToString(),
                    BankName = emp.bankname?.ToString(),
                    AccountHolderName = emp.accountholdername?.ToString(),
                    IfscCode = emp.ifsccode?.ToString(),
                    UpiId = emp.upiid?.ToString()
                });
                continue;
            }
        }

        return results;
    }

    public async Task<int> CreatePayrollPaymentAsync(PayrollPayment payment)
    {
        var sql = @"
            INSERT INTO t_payrollpayments (empid, spaceid, totalamount, deduction, finalamount, status, paidat, createdat, ismanual, allowanceamount, deductionamount, paymentmethod, transactionid, groupid)
            VALUES (@EmpId, @SpaceId, @TotalAmount, @Deduction, @FinalAmount, @Status, @PaidAt, NOW(), @IsManual, @AllowanceAmount, @DeductionAmount, @PaymentMethod, @TransactionId, @GroupId)
            RETURNING paymentid;";
        return await _dbConnection.ExecuteScalarAsync<int>(sql, payment);
    }

    public async Task<bool> UpdatePayrollPaymentStatusAsync(int empid, int spaceId, string status)
    {
        var sql = @"
            UPDATE t_payrollpayments
            SET status = @Status, paidat = CASE WHEN @Status = 'Paid' THEN NOW() ELSE NULL END
            WHERE empid = @EmpId AND spaceid = @SpaceId;";
        var rows = await _dbConnection.ExecuteAsync(sql, new { EmpId = empid, SpaceId = spaceId, Status = status });
        return rows > 0;
    }

    public async Task<bool> GeneratePayrollPayslipAsync(Payslip payslip)
    {
        // Ensure month/year are set — default to current UTC if not provided
        int payMonth = payslip.Month > 0 ? payslip.Month : DateTime.UtcNow.Month;
        int payYear  = payslip.Year  > 0 ? payslip.Year  : DateTime.UtcNow.Year;

        var sql = @"
            INSERT INTO t_payslips (empid, spaceid, baseamount, deduction, finalamount, type, paymentid, generatedat, month, year, basic, totalallowance, totaldeduction, breakdown, paymentmethod, transactionid, accountnumber, bankname, accountholdername, ifsccode, upiid)
            VALUES (@EmpId, @SpaceId, @BaseAmount, @Deduction, @FinalAmount, 'Payroll', @PaymentId, NOW(), @PayMonth, @PayYear, @Basic, @TotalAllowance, @TotalDeduction, @Breakdown, @PaymentMethod, @TransactionId, @AccountNumber, @BankName, @AccountHolderName, @IfscCode, @UpiId);";
        var rows = await _dbConnection.ExecuteAsync(sql, new {
            payslip.EmpId,
            payslip.SpaceId,
            payslip.BaseAmount,
            payslip.Deduction,
            payslip.FinalAmount,
            payslip.PaymentId,
            PayMonth = payMonth,
            PayYear  = payYear,
            payslip.Basic,
            payslip.TotalAllowance,
            payslip.TotalDeduction,
            payslip.Breakdown,
            payslip.PaymentMethod,
            payslip.TransactionId,
            payslip.AccountNumber,
            payslip.BankName,
            payslip.AccountHolderName,
            payslip.IfscCode,
            payslip.UpiId
        });
        return rows > 0;
    }

    public async Task<bool> ResetSpacePayrollPaymentsAsync(int spaceId)
    {
        var sqlSlips = "DELETE FROM t_payslips WHERE spaceid = @SpaceId;";
        var sqlPayments = "DELETE FROM t_payrollpayments WHERE spaceid = @SpaceId;";
        await _dbConnection.ExecuteAsync(sqlSlips, new { SpaceId = spaceId });
        var rows = await _dbConnection.ExecuteAsync(sqlPayments, new { SpaceId = spaceId });
        return rows > 0;
    }

    public async Task<bool> UpdateEmployeeBasicSalaryAsync(int empId, int spaceId, decimal basic)
    {
        var sql = @"
            INSERT INTO t_employeesalary (empid, spaceid, basic, createdat)
            VALUES (@EmpId, @SpaceId, @Basic, NOW())
            ON CONFLICT (empid) 
            DO UPDATE SET basic = @Basic, spaceid = @SpaceId;";
        var rows = await _dbConnection.ExecuteAsync(sql, new { EmpId = empId, SpaceId = spaceId, Basic = basic });
        return rows > 0;
    }

    public async Task<decimal> GetEmployeeBasicSalaryAsync(int empId)
    {
        var sql = "SELECT basic FROM t_employeesalary WHERE empid = @EmpId;";
        var basic = await _dbConnection.QueryFirstOrDefaultAsync<decimal?>(sql, new { EmpId = empId });
        return basic ?? 25000m;
    }

    public async Task<IEnumerable<Allowance>> GetAllowancesBySpaceIdAsync(int spaceId)
    {
        var sql = "SELECT * FROM t_allowances WHERE spaceid = @SpaceId ORDER BY allowanceid ASC;";
        return await _dbConnection.QueryAsync<Allowance>(sql, new { SpaceId = spaceId });
    }

    public async Task<int> CreateAllowanceAsync(Allowance allowance)
    {
        var sql = @"
            INSERT INTO t_allowances (adminid, spaceid, name, type, value, createdat)
            VALUES (@AdminId, @SpaceId, @Name, @Type, @Value, NOW())
            RETURNING allowanceid;";
        return await _dbConnection.ExecuteScalarAsync<int>(sql, allowance);
    }

    public async Task<bool> DeleteAllowanceAsync(int allowanceId)
    {
        var sql = "DELETE FROM t_allowances WHERE allowanceid = @AllowanceId;";
        var rows = await _dbConnection.ExecuteAsync(sql, new { AllowanceId = allowanceId });
        return rows > 0;
    }

    public async Task<IEnumerable<Deduction>> GetDeductionsBySpaceIdAsync(int spaceId)
    {
        return await PenaltyCalibrator.EnsurePenaltyDeductionsAsync(_dbConnection, spaceId);
    }

    public async Task<int> CreateDeductionAsync(Deduction deduction)
    {
        var sql = @"
            INSERT INTO t_deductions (adminid, spaceid, name, type, value, deductiontype, createdat)
            VALUES (@AdminId, @SpaceId, @Name, @Type, @Value, @DeductionType, NOW())
            RETURNING deductionid;";
        return await _dbConnection.ExecuteScalarAsync<int>(sql, deduction);
    }

    public async Task<bool> DeleteDeductionAsync(int deductionId)
    {
        var sql = "DELETE FROM t_deductions WHERE deductionid = @DeductionId;";
        var rows = await _dbConnection.ExecuteAsync(sql, new { DeductionId = deductionId });
        return rows > 0;
    }
}
