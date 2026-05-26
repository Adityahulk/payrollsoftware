namespace Backend.Repositories;

using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class SalaryRepository : ISalaryRepository
{
    private readonly IDbConnection _db;

    public SalaryRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task EnsureWorklogTableAsync()
    {
        var sql = @"
            CREATE TABLE IF NOT EXISTS t_worklogs (
                logid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                taskid INTEGER NOT NULL,
                hoursworked NUMERIC(5,2) NOT NULL,
                description TEXT,
                workdate DATE NOT NULL DEFAULT CURRENT_DATE,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );";
        await _db.ExecuteAsync(sql);
    }

    public async Task EnsureSalaryTableAsync()
    {
        var sql = @"
            CREATE TABLE IF NOT EXISTS t_salary (
                salaryid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL UNIQUE,
                basic NUMERIC(12,2) NOT NULL DEFAULT 25000,
                hra NUMERIC(12,2) NOT NULL DEFAULT 10000,
                da NUMERIC(12,2) NOT NULL DEFAULT 3000,
                pf NUMERIC(12,2) NOT NULL DEFAULT 0,
                tds NUMERIC(12,2) NOT NULL DEFAULT 0
            );";
        await _db.ExecuteAsync(sql);
    }

    public async Task<SalaryResponse?> GetSalaryAsync(int empId, int month, int year)
    {
        // 1. Get employee basic salary from t_employeesalary
        var basicSql = @"SELECT basic FROM t_employeesalary WHERE empid = @EmpId";
        var basicVal = await _db.QueryFirstOrDefaultAsync<decimal?>(basicSql, new { EmpId = empId });
        
        // Get user's role and spaceId
        var userSql = @"SELECT role, spaceid FROM t_users WHERE empid = @EmpId";
        var userRow = await _db.QueryFirstOrDefaultAsync<dynamic>(userSql, new { EmpId = empId });
        string role = userRow?.role ?? "Employee";
        int? spaceId = null;
        if (userRow != null && userRow.spaceid != null)
        {
            spaceId = Convert.ToInt32(userRow.spaceid);
        }

        // Fallback for basic salary
        decimal basic = basicVal ?? 0m;
        if (basic == 0m)
        {
            // Try fallback to t_salary
            var oldSalSql = @"SELECT basic FROM t_salary WHERE empid = @EmpId";
            var oldBasic = await _db.QueryFirstOrDefaultAsync<decimal?>(oldSalSql, new { EmpId = empId });
            basic = oldBasic ?? (role switch
            {
                "Admin" => 65000m,
                "Manager" => 45000m,
                "TeamLead" => 35000m,
                _ => 25000m
            });
        }

        decimal breakTimeLimitHours = 1.0m; // fallback 60 minutes
        if (spaceId.HasValue && spaceId.Value > 0)
        {
            var breaktimeMinutes = await _db.QueryFirstOrDefaultAsync<int?>(
                "SELECT breaktime FROM t_spaces WHERE spaceid = @SpaceId;",
                new { SpaceId = spaceId.Value });
            if (breaktimeMinutes.HasValue)
            {
                breakTimeLimitHours = breaktimeMinutes.Value / 60.0m;
            }
        }

        var responseAllowances = new List<BreakdownItem>();
        var responseDeductions = new List<BreakdownItem>();

        decimal hra = 0m;
        decimal da = 0m;
        bool hasSpaceAllowances = false;

        if (spaceId.HasValue && spaceId.Value > 0)
        {
            var allowancesSql = @"SELECT allowanceid, adminid, spaceid, name, type, value FROM t_allowances WHERE spaceid = @SpaceId";
            var allowances = await _db.QueryAsync<dynamic>(allowancesSql, new { SpaceId = spaceId.Value });
            var allowanceList = allowances.AsList();
            if (allowanceList.Count > 0)
            {
                hasSpaceAllowances = true;
                foreach (var allowance in allowanceList)
                {
                    string allowanceName = allowance.name?.ToString() ?? "";
                    string allowanceType = allowance.type?.ToString() ?? "Fixed";
                    decimal val = Convert.ToDecimal(allowance.value ?? 0);
                    decimal amt = allowanceType.Equals("Percentage", StringComparison.OrdinalIgnoreCase) 
                        ? Math.Round(basic * val / 100m, 2) 
                        : val;

                    responseAllowances.Add(new BreakdownItem
                    {
                        Name = allowanceName,
                        Type = allowanceType,
                        Value = val,
                        Amount = amt
                    });

                    if (allowanceName.Contains("DA", StringComparison.OrdinalIgnoreCase) || allowanceName.Contains("Dearness", StringComparison.OrdinalIgnoreCase))
                    {
                        da += amt;
                    }
                    else
                    {
                        hra += amt;
                    }
                }
            }
        }

        if (!hasSpaceAllowances)
        {
            var oldSalarySql = @"SELECT hra, da FROM t_salary WHERE empid = @EmpId";
            var oldSalRow = await _db.QueryFirstOrDefaultAsync<dynamic>(oldSalarySql, new { EmpId = empId });
            hra = oldSalRow != null && oldSalRow.hra != null ? Convert.ToDecimal(oldSalRow.hra) : (role switch
            {
                "Admin" => 25000m,
                "Manager" => 18000m,
                "TeamLead" => 15000m,
                _ => 10000m
            });
            da = oldSalRow != null && oldSalRow.da != null ? Convert.ToDecimal(oldSalRow.da) : (role switch
            {
                "Admin" => 10000m,
                "Manager" => 7000m,
                "TeamLead" => 5000m,
                _ => 3000m
            });

            responseAllowances.Add(new BreakdownItem { Name = "HRA", Type = "Fixed", Value = hra, Amount = hra });
            responseAllowances.Add(new BreakdownItem { Name = "DA", Type = "Fixed", Value = da, Amount = da });
        }

        decimal pf = 0m;
        decimal tds = 0m;
        bool hasSpaceDeductions = false;
        var spaceDeductions = new List<Deduction>();

        if (spaceId.HasValue && spaceId.Value > 0)
        {
            spaceDeductions = await PenaltyCalibrator.EnsurePenaltyDeductionsAsync(_db, spaceId.Value);
        }

        if (spaceId.HasValue && spaceId.Value > 0 && spaceDeductions.Count > 0)
        {
            var calibratedRates = PenaltyCalibrator.GetCalibratedRates(basic, spaceDeductions);
            foreach (var ded in spaceDeductions)
            {
                // Skip if this deduction is classified as a performance penalty
                if (calibratedRates.PenaltyDeductionIds.Contains(ded.DeductionId))
                {
                    continue;
                }

                hasSpaceDeductions = true;
                string deductionName = ded.Name ?? "";
                string deductionType = ded.Type ?? "Fixed";
                decimal val = ded.Value;
                decimal amt = deductionType.Equals("Percentage", StringComparison.OrdinalIgnoreCase) 
                    ? Math.Round(basic * val / 100m, 2) 
                    : val;

                responseDeductions.Add(new BreakdownItem
                {
                    Name = deductionName,
                    Type = deductionType,
                    Value = val,
                    Amount = amt,
                    DeductionType = ded.DeductionType ?? "Standard"
                });

                if (deductionName.Contains("PF", StringComparison.OrdinalIgnoreCase) || deductionName.Contains("Provident", StringComparison.OrdinalIgnoreCase))
                {
                    pf += amt;
                }
                else
                {
                    tds += amt;
                }
            }
        }

        if (!hasSpaceDeductions)
        {
            var oldSalarySql = @"SELECT pf, tds FROM t_salary WHERE empid = @EmpId";
            var oldSalRow = await _db.QueryFirstOrDefaultAsync<dynamic>(oldSalarySql, new { EmpId = empId });
            pf = oldSalRow != null && oldSalRow.pf != null ? Convert.ToDecimal(oldSalRow.pf) : Math.Round(basic * 0.12m, 2);
            tds = oldSalRow != null && oldSalRow.tds != null ? Convert.ToDecimal(oldSalRow.tds) : Math.Round((basic + hra + da) * 0.08m, 2);

            responseDeductions.Add(new BreakdownItem { Name = "PF", Type = "Percentage", Value = 12m, Amount = pf });
            responseDeductions.Add(new BreakdownItem { Name = "TDS", Type = "Percentage", Value = 8m, Amount = tds });
        }

        // Query attendance records for the target employee, month, and year
        var attendanceRecords = await _db.QueryAsync<dynamic>(
            @"SELECT status, lateminutes, earlyexitminutes, breakhours, attendancedate::timestamp AS attendancedate 
              FROM t_attendance 
              WHERE empid = @EmpId
                AND EXTRACT(MONTH FROM attendancedate) = @Month
                AND EXTRACT(YEAR FROM attendancedate) = @Year;",
            new { EmpId = empId, Month = month, Year = year });

        // Query project tasks for target employee with worklog hours to check completion
        var taskRecords = await _db.QueryAsync<dynamic>(
            @"SELECT 
                t.taskstatus,
                COALESCE(t.estimatedhours, 8) AS estimatedhours,
                COALESCE(SUM(w.hoursworked), 0) AS actualhours
              FROM t_projecttasks t
              LEFT JOIN t_worklogs w ON t.taskid = w.taskid AND w.empid = @EmpId
              WHERE t.assignedtoempid = @EmpId
              GROUP BY t.taskid, t.taskstatus, t.estimatedhours;",
            new { EmpId = empId });

        // Get working days for this employee's space
        List<string> salaryWorkingDays;
        if (spaceId.HasValue && spaceId.Value > 0)
        {
            var wdRaw = await _db.QueryFirstOrDefaultAsync<string>(
                "SELECT workingdays FROM t_spaces WHERE spaceid = @SpaceId",
                new { SpaceId = spaceId.Value });
            if (!string.IsNullOrWhiteSpace(wdRaw))
            {
                try { salaryWorkingDays = System.Text.Json.JsonSerializer.Deserialize<List<string>>(wdRaw) ?? new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri" }; }
                catch { salaryWorkingDays = new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri" }; }
            }
            else
            {
                salaryWorkingDays = new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri" };
            }
        }
        else
        {
            salaryWorkingDays = new List<string> { "Mon", "Tue", "Wed", "Thu", "Fri" };
        }

        int lateCount = 0;
        int earlyExitCount = 0;
        int excessBreakCount = 0;

        foreach (var att in attendanceRecords)
        {
            // Check if this day is a working day
            DateTime attDate = DateTime.MinValue;
            if (att.attendancedate != null)
            {
                attDate = att.attendancedate is DateOnly dOnly 
                    ? dOnly.ToDateTime(TimeOnly.MinValue) 
                    : Convert.ToDateTime(att.attendancedate);
            }
            string attDayName = Space.DayOfWeekToShortName(attDate.DayOfWeek);
            bool isWorkingDay = salaryWorkingDays.Contains(attDayName, StringComparer.OrdinalIgnoreCase);

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

        // Dynamic absence calculation
        int absentCount = 0;
        {
            var empDojSql = "SELECT COALESCE(dateofjoining, CURRENT_DATE)::timestamp FROM t_users WHERE empid = @EmpId";
            var empDojRaw = await _db.ExecuteScalarAsync(empDojSql, new { EmpId = empId });
            DateTime empDoj = empDojRaw is DateOnly dojOnly 
                ? dojOnly.ToDateTime(TimeOnly.MinValue) 
                : (empDojRaw != null ? Convert.ToDateTime(empDojRaw) : DateTime.Today);

            var attDatesSql = @"SELECT DATE(attendancedate)::timestamp FROM t_attendance 
                WHERE empid = @EmpId AND EXTRACT(MONTH FROM attendancedate) = @Month AND EXTRACT(YEAR FROM attendancedate) = @Year";
            var attDatesRaw = await _db.QueryAsync<DateTime?>(attDatesSql, new { EmpId = empId, Month = month, Year = year });
            var attDatesSet = new HashSet<DateTime>((attDatesRaw ?? System.Linq.Enumerable.Empty<DateTime?>())
                .Where(d => d.HasValue)
                .Select(d => d.Value.Date));

            var leavesSql = @"SELECT leavedate::timestamp FROM t_leaves WHERE empid = @EmpId AND status = 'Approved'
                AND EXTRACT(MONTH FROM leavedate) = @Month AND EXTRACT(YEAR FROM leavedate) = @Year";
            var leaveDatesRaw = await _db.QueryAsync<DateTime?>(leavesSql, new { EmpId = empId, Month = month, Year = year });
            var leaveDatesSet = new HashSet<DateTime>((leaveDatesRaw ?? System.Linq.Enumerable.Empty<DateTime?>())
                .Where(d => d.HasValue)
                .Select(d => d.Value.Date));

            var mStart = new DateTime(year, month, 1);
            var mEnd = new DateTime(year, month, DateTime.DaysInMonth(year, month));
            if (mEnd > DateTime.Today) mEnd = DateTime.Today;
            if (mStart < empDoj.Date) mStart = empDoj.Date;

            for (var d = mStart; d <= mEnd; d = d.AddDays(1))
            {
                string dayName = Space.DayOfWeekToShortName(d.DayOfWeek);
                if (!salaryWorkingDays.Contains(dayName, StringComparer.OrdinalIgnoreCase)) continue;
                if (attDatesSet.Contains(d.Date)) continue;
                if (leaveDatesSet.Contains(d.Date)) continue;
                absentCount++;
            }
        }


        int pendingTaskCount = 0;
        foreach (var task in taskRecords)
        {
            string tstatus = task.taskstatus?.ToString() ?? "";
            decimal est = Convert.ToDecimal(task.estimatedhours ?? 8);
            decimal actual = Convert.ToDecimal(task.actualhours ?? 0);

            bool isCompleted = tstatus.Equals("Completed", StringComparison.OrdinalIgnoreCase) || 
                               tstatus.Equals("Complete", StringComparison.OrdinalIgnoreCase) || 
                               tstatus.Equals("Resolve", StringComparison.OrdinalIgnoreCase) ||
                               actual >= est;

            if (!isCompleted)
            {
                pendingTaskCount++;
            }
        }

        // Calibrate penalty rates
        var rates = PenaltyCalibrator.GetCalibratedRates(basic, spaceDeductions);

        // Find penalty deductions if they exist in DB to get their custom name, type, and value
        var absentDed = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Absent" || d.Name.Contains("absent", StringComparison.OrdinalIgnoreCase) || d.Name.Contains("absence", StringComparison.OrdinalIgnoreCase));
        var lateDed = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Late" || d.Name.Contains("late", StringComparison.OrdinalIgnoreCase));
        var earlyExitDed = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Early Exit" || d.Name.Contains("early", StringComparison.OrdinalIgnoreCase));
        var breakDed = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Excess Break" || d.Name.Contains("break", StringComparison.OrdinalIgnoreCase));
        var taskDed = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Pending Tasks" || d.Name.Contains("task", StringComparison.OrdinalIgnoreCase) || d.Name.Contains("pending", StringComparison.OrdinalIgnoreCase));

        decimal totalPerformanceDeduction = 0m;

        void ProcessPenalty(Deduction? customDed, string defaultName, decimal defaultValue, int occurrences, decimal rate, string penaltyType)
        {
            decimal amt = occurrences * rate;
            if (amt <= 0m) return;
            
            string pName = customDed != null ? customDed.Name : defaultName;
            string pType = customDed != null ? customDed.Type : "Fixed";
            decimal pVal = customDed != null ? customDed.Value : defaultValue;
            
            string rateText = pType.Equals("Percentage", StringComparison.OrdinalIgnoreCase) 
                ? $"{pVal.ToString("0.##")}% of Basic" 
                : $"₹{pVal.ToString("0.##")}";
            
            string unitLabel = penaltyType switch
            {
                "Absent" => occurrences == 1 ? "absence" : "absences",
                "Late" => occurrences == 1 ? "late clock-in" : "late clock-ins",
                "Early Exit" => occurrences == 1 ? "early exit" : "early exits",
                "Excess Break" => occurrences == 1 ? "excess break" : "excess breaks",
                "Pending Tasks" => occurrences == 1 ? "pending task" : "pending tasks",
                _ => occurrences == 1 ? "occurrence" : "occurrences"
            };
            
            string formattedName = $"{pName} ({occurrences} {unitLabel}, {rateText} each)";

            responseDeductions.Add(new BreakdownItem
            {
                Name = formattedName,
                Type = pType,
                Value = pVal,
                Amount = amt,
                DeductionType = penaltyType
            });
            totalPerformanceDeduction += amt;
        }

        ProcessPenalty(absentDed, "Absent Penalty", 1000m, absentCount, rates.AbsentRate, "Absent");
        ProcessPenalty(lateDed, "Late Clock-In Penalty", 200m, lateCount, rates.LateRate, "Late");
        ProcessPenalty(earlyExitDed, "Early Exit Penalty", 200m, earlyExitCount, rates.EarlyExitRate, "Early Exit");
        ProcessPenalty(breakDed, "Excess Break Penalty", 150m, excessBreakCount, rates.ExcessBreakRate, "Excess Break");
        ProcessPenalty(taskDed, "Pending Tasks Penalty", 500m, pendingTaskCount, rates.PendingTaskRate, "Pending Tasks");

        decimal gross = basic + hra + da;
        decimal totalDeductions = pf + tds + totalPerformanceDeduction;
        decimal net = gross - totalDeductions;
        if (net < 0m) net = 0m;

        return new SalaryResponse
        {
            Basic = basic,
            Hra = hra,
            Da = da,
            Gross = gross,
            Pf = pf,
            Tds = tds,
            Net = net,
            Month = month,
            Year = year,
            Allowances = responseAllowances,
            Deductions = responseDeductions
        };
    }

    public async Task<ProgressReport> GetProgressReportAsync(int empId)
    {
        // Task stats — including worklog hours to check completion
        int total = 0, completed = 0;
        try
        {
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
                    COUNT(*)::int AS total,
                    SUM(CASE 
                        WHEN taskstatus IN ('Completed', 'Complete', 'Resolve') THEN 1
                        WHEN actualhours >= estimatedhours THEN 1
                        ELSE 0
                    END)::int AS completed
                FROM task_stats";
            var taskRow = await _db.QueryFirstOrDefaultAsync(taskSql, new { EmpId = empId });
            total    = Convert.ToInt32(taskRow?.total    ?? 0);
            completed = Convert.ToInt32(taskRow?.completed ?? 0);
        }
        catch { }


        // Hours worked
        decimal hoursWorked = 0;
        try
        {
            var hoursSql = @"SELECT COALESCE(SUM(hoursworked), 0) FROM t_worklogs WHERE empid = @EmpId";
            hoursWorked = Convert.ToDecimal(await _db.ExecuteScalarAsync(hoursSql, new { EmpId = empId }) ?? 0);
        }
        catch { }

        // Attendance %
        decimal attendancePct = 0;
        try
        {
            var attSql = @"
                SELECT 
                    CASE WHEN COUNT(*) = 0 THEN 0
                    ELSE ROUND(COUNT(*) FILTER (WHERE status = 'Present') * 100.0 / COUNT(*), 1)
                    END
                FROM t_attendance WHERE empid = @EmpId";
            attendancePct = Convert.ToDecimal(await _db.ExecuteScalarAsync(attSql, new { EmpId = empId }) ?? 0);
        }
        catch { }

        return new ProgressReport
        {
            TotalTasks = total,
            CompletedTasks = completed,
            PendingTasks = total - completed,
            TotalHoursWorked = hoursWorked,
            AttendancePercentage = attendancePct
        };
    }

    public async Task<IEnumerable<PayrollPayment>> GetPaymentHistoryAsync(int empId, int limit = 12)
    {
        var sql = @"
            SELECT paymentid, empid, spaceid, totalamount, deduction, finalamount,
                   status, paidat, createdat, ismanual, allowanceamount, deductionamount,
                   paymentmethod, transactionid, groupid
            FROM t_payrollpayments
            WHERE empid = @EmpId
            ORDER BY COALESCE(paidat, createdat) DESC
            LIMIT @Limit";

        var results = await _db.QueryAsync<PayrollPayment>(sql, new { EmpId = empId, Limit = limit });
        return results;
    }

    public async Task<CtcSummaryResponse> GetCtcSummaryAsync(int empId, int year)
    {
        // Get the base salary structure (reuse existing logic — auto-seeds if needed)
        var salaryData = await GetSalaryAsync(empId, 1, year);

        if (salaryData == null)
        {
            return new CtcSummaryResponse { Year = year };
        }

        var annualBasic = salaryData.Basic * 12;
        var annualHra = salaryData.Hra * 12;
        var annualDa = salaryData.Da * 12;
        var annualGross = salaryData.Gross * 12;
        var annualPf = salaryData.Pf * 12;
        var annualTds = salaryData.Tds * 12;
        var annualNet = salaryData.Net * 12;

        return new CtcSummaryResponse
        {
            Year = year,
            AnnualBasic = annualBasic,
            AnnualHra = annualHra,
            AnnualDa = annualDa,
            AnnualGross = annualGross,
            AnnualPf = annualPf,
            AnnualTds = annualTds,
            AnnualNet = annualNet,
            MonthlyNet = salaryData.Net
        };
    }

    public async Task<IEnumerable<Payslip>> GetMyPayslipsAsync(int empId, int limit = 24)
    {
        var sql = @"
            SELECT slipid, empid, spaceid, baseamount, deduction, finalamount, type,
                   paymentid, generatedat, basic, totalallowance, totaldeduction,
                   breakdown, paymentmethod, transactionid,
                   accountnumber, bankname, accountholdername, ifsccode, upiid
            FROM t_payslips
            WHERE empid = @EmpId AND type = 'Payroll'
            ORDER BY generatedat DESC
            LIMIT @Limit";

        try
        {
            return await _db.QueryAsync<Payslip>(sql, new { EmpId = empId, Limit = limit });
        }
        catch
        {
            // t_payslips may not have all columns yet — return empty list gracefully
            return System.Linq.Enumerable.Empty<Payslip>();
        }
    }
}
