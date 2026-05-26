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
        // ─── Single round-trip: combine 7 sequential queries into 1 ───
        var multiSql = @"
            -- Q1: basic salary from new table
            SELECT basic FROM t_employeesalary WHERE empid = @EmpId;

            -- Q2: role and spaceid
            SELECT role, spaceid FROM t_users WHERE empid = @EmpId;

            -- Q3: fallback salary (old table)
            SELECT basic, hra, da, pf, tds FROM t_salary WHERE empid = @EmpId;

            -- Q4: DOJ for absence calculation
            SELECT COALESCE(dateofjoining, CURRENT_DATE)::timestamp AS doj FROM t_users WHERE empid = @EmpId;

            -- Q5: attendance for this month (limited to current year)
            SELECT status, lateminutes, earlyexitminutes, breakhours,
                   attendancedate::timestamp AS attendancedate
            FROM t_attendance
            WHERE empid = @EmpId
              AND EXTRACT(MONTH FROM attendancedate) = @Month
              AND EXTRACT(YEAR FROM attendancedate) = @Year
            ORDER BY attendancedate DESC
            LIMIT 365;

            -- Q6: attendance dates this month (for absence calc)
            SELECT DATE(attendancedate)::timestamp AS adate
            FROM t_attendance
            WHERE empid = @EmpId
              AND EXTRACT(MONTH FROM attendancedate) = @Month
              AND EXTRACT(YEAR FROM attendancedate) = @Year;

            -- Q7: approved leave dates this month
            SELECT leavedate::timestamp AS ldate
            FROM t_leaves
            WHERE empid = @EmpId
              AND status = 'Approved'
              AND EXTRACT(MONTH FROM leavedate) = @Month
              AND EXTRACT(YEAR FROM leavedate) = @Year;

            -- Q8: task records for pending-task penalty
            SELECT t.taskstatus,
                   COALESCE(t.estimatedhours, 8) AS estimatedhours,
                   COALESCE(SUM(w.hoursworked), 0) AS actualhours
            FROM t_projecttasks t
            LEFT JOIN t_worklogs w ON t.taskid = w.taskid AND w.empid = @EmpId
            WHERE t.assignedtoempid = @EmpId
            GROUP BY t.taskid, t.taskstatus, t.estimatedhours;";

        decimal? basicVal = null;
        dynamic? userRow = null;
        dynamic? oldSalRow = null;
        DateTime empDoj = DateTime.Today;
        IEnumerable<dynamic> attendanceRecords = Enumerable.Empty<dynamic>();
        HashSet<DateTime> attDatesSet = new();
        HashSet<DateTime> leaveDatesSet = new();
        IEnumerable<dynamic> taskRecords = Enumerable.Empty<dynamic>();

        try
        {
            using var multi = await _db.QueryMultipleAsync(multiSql,
                new { EmpId = empId, Month = month, Year = year });

            basicVal        = await multi.ReadFirstOrDefaultAsync<decimal?>();
            userRow         = await multi.ReadFirstOrDefaultAsync<dynamic>();
            oldSalRow       = await multi.ReadFirstOrDefaultAsync<dynamic>();
            var dojRaw      = await multi.ReadFirstOrDefaultAsync<dynamic>();
            attendanceRecords = (await multi.ReadAsync<dynamic>()).AsList();
            var attDatesRaw  = (await multi.ReadAsync<dynamic>()).AsList();
            var leaveDatesRaw= (await multi.ReadAsync<dynamic>()).AsList();
            taskRecords      = (await multi.ReadAsync<dynamic>()).AsList();

            DateTime parsedDoj = DateTime.MinValue;
            if (dojRaw?.doj != null && DateTime.TryParse(dojRaw.doj.ToString(), out parsedDoj))
                empDoj = parsedDoj;

            foreach (var d in attDatesRaw)
            {
                DateTime ad = DateTime.MinValue;
                if (d?.adate != null && DateTime.TryParse(d.adate.ToString(), out ad))
                    attDatesSet.Add(ad.Date);
            }
            foreach (var d in leaveDatesRaw)
            {
                DateTime ld = DateTime.MinValue;
                if (d?.ldate != null && DateTime.TryParse(d.ldate.ToString(), out ld))
                    leaveDatesSet.Add(ld.Date);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SalaryRepo] QueryMultiple failed, falling back to sequential. {ex.Message}");
            // Graceful fallback to sequential queries if multi-statement not supported
            basicVal = await _db.QueryFirstOrDefaultAsync<decimal?>(
                "SELECT basic FROM t_employeesalary WHERE empid = @EmpId", new { EmpId = empId });
            userRow  = await _db.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT role, spaceid FROM t_users WHERE empid = @EmpId", new { EmpId = empId });
            oldSalRow= await _db.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT basic, hra, da, pf, tds FROM t_salary WHERE empid = @EmpId", new { EmpId = empId });
            attendanceRecords = await _db.QueryAsync<dynamic>(
                @"SELECT status, lateminutes, earlyexitminutes, breakhours,
                         attendancedate::timestamp AS attendancedate
                  FROM t_attendance WHERE empid = @EmpId
                  AND EXTRACT(MONTH FROM attendancedate) = @Month
                  AND EXTRACT(YEAR FROM attendancedate) = @Year LIMIT 365",
                new { EmpId = empId, Month = month, Year = year });
            taskRecords = await _db.QueryAsync<dynamic>(
                @"SELECT t.taskstatus, COALESCE(t.estimatedhours,8) AS estimatedhours,
                         COALESCE(SUM(w.hoursworked),0) AS actualhours
                  FROM t_projecttasks t
                  LEFT JOIN t_worklogs w ON t.taskid=w.taskid AND w.empid=@EmpId
                  WHERE t.assignedtoempid=@EmpId
                  GROUP BY t.taskid, t.taskstatus, t.estimatedhours",
                new { EmpId = empId });
        }

        string role = userRow?.role ?? "Employee";
        int? spaceId = null;
        if (userRow?.spaceid != null)
            spaceId = Convert.ToInt32(userRow.spaceid);

        // Resolve basic salary with fallback chain
        decimal basic = basicVal ?? 0m;
        if (basic == 0m)
        {
            var oldBasic = oldSalRow != null && oldSalRow.basic != null
                ? (decimal?)Convert.ToDecimal(oldSalRow.basic) : null;
            basic = oldBasic ?? (role switch
            {
                "Admin"    => 65000m,
                "Manager"  => 45000m,
                "TeamLead" => 35000m,
                _ => 25000m
            });
        }

        // Break-time limit for this space
        decimal breakTimeLimitHours = 1.0m;
        if (spaceId.HasValue && spaceId.Value > 0)
        {
            var breaktimeMinutes = await _db.QueryFirstOrDefaultAsync<int?>(
                "SELECT breaktime FROM t_spaces WHERE spaceid = @SpaceId;",
                new { SpaceId = spaceId.Value });
            if (breaktimeMinutes.HasValue)
                breakTimeLimitHours = breaktimeMinutes.Value / 60.0m;
        }

        var responseAllowances = new List<BreakdownItem>();
        var responseDeductions = new List<BreakdownItem>();

        decimal hra = 0m, da = 0m;
        bool hasSpaceAllowances = false;

        if (spaceId.HasValue && spaceId.Value > 0)
        {
            var allowancesSql = "SELECT allowanceid, adminid, spaceid, name, type, value FROM t_allowances WHERE spaceid = @SpaceId";
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
                        ? Math.Round(basic * val / 100m, 2) : val;

                    responseAllowances.Add(new BreakdownItem { Name = allowanceName, Type = allowanceType, Value = val, Amount = amt });

                    if (allowanceName.Contains("DA", StringComparison.OrdinalIgnoreCase) || allowanceName.Contains("Dearness", StringComparison.OrdinalIgnoreCase))
                        da += amt;
                    else
                        hra += amt;
                }
            }
        }

        if (!hasSpaceAllowances)
        {
            hra = oldSalRow != null && oldSalRow.hra != null ? Convert.ToDecimal(oldSalRow.hra) : (role switch
            {
                "Admin" => 25000m, "Manager" => 18000m, "TeamLead" => 15000m, _ => 10000m
            });
            da  = oldSalRow != null && oldSalRow.da  != null ? Convert.ToDecimal(oldSalRow.da)  : (role switch
            {
                "Admin" => 10000m, "Manager" => 7000m,  "TeamLead" => 5000m,  _ => 3000m
            });
            responseAllowances.Add(new BreakdownItem { Name = "HRA", Type = "Fixed", Value = hra, Amount = hra });
            responseAllowances.Add(new BreakdownItem { Name = "DA",  Type = "Fixed", Value = da,  Amount = da  });
        }

        decimal pf = 0m, tds = 0m;
        bool hasSpaceDeductions = false;
        var spaceDeductions = new List<Deduction>();

        if (spaceId.HasValue && spaceId.Value > 0)
            spaceDeductions = await PenaltyCalibrator.EnsurePenaltyDeductionsAsync(_db, spaceId.Value);

        if (spaceId.HasValue && spaceId.Value > 0 && spaceDeductions.Count > 0)
        {
            var calibratedRates = PenaltyCalibrator.GetCalibratedRates(basic, spaceDeductions);
            foreach (var ded in spaceDeductions)
            {
                if (calibratedRates.PenaltyDeductionIds.Contains(ded.DeductionId)) continue;

                hasSpaceDeductions = true;
                string deductionName = ded.Name ?? "";
                string deductionType = ded.Type ?? "Fixed";
                decimal val = ded.Value;
                decimal amt = deductionType.Equals("Percentage", StringComparison.OrdinalIgnoreCase)
                    ? Math.Round(basic * val / 100m, 2) : val;

                responseDeductions.Add(new BreakdownItem
                {
                    Name = deductionName, Type = deductionType, Value = val, Amount = amt,
                    DeductionType = ded.DeductionType ?? "Standard"
                });

                if (deductionName.Contains("PF", StringComparison.OrdinalIgnoreCase) || deductionName.Contains("Provident", StringComparison.OrdinalIgnoreCase))
                    pf += amt;
                else
                    tds += amt;
            }
        }

        if (!hasSpaceDeductions)
        {
            pf  = oldSalRow != null && oldSalRow.pf  != null ? Convert.ToDecimal(oldSalRow.pf)  : Math.Round(basic * 0.12m, 2);
            tds = oldSalRow != null && oldSalRow.tds != null ? Convert.ToDecimal(oldSalRow.tds) : Math.Round((basic + hra + da) * 0.08m, 2);
            responseDeductions.Add(new BreakdownItem { Name = "PF",  Type = "Percentage", Value = 12m, Amount = pf  });
            responseDeductions.Add(new BreakdownItem { Name = "TDS", Type = "Percentage", Value = 8m,  Amount = tds });
        }

        // Get working days for this employee's space
        List<string> salaryWorkingDays;
        if (spaceId.HasValue && spaceId.Value > 0)
        {
            var wdRaw = await _db.QueryFirstOrDefaultAsync<string>(
                "SELECT workingdays FROM t_spaces WHERE spaceid = @SpaceId",
                new { SpaceId = spaceId.Value });
            if (!string.IsNullOrWhiteSpace(wdRaw))
            {
                try { salaryWorkingDays = System.Text.Json.JsonSerializer.Deserialize<List<string>>(wdRaw) ?? new List<string> { "Mon","Tue","Wed","Thu","Fri" }; }
                catch { salaryWorkingDays = new List<string> { "Mon","Tue","Wed","Thu","Fri" }; }
            }
            else salaryWorkingDays = new List<string> { "Mon","Tue","Wed","Thu","Fri" };
        }
        else
        {
            salaryWorkingDays = new List<string> { "Mon","Tue","Wed","Thu","Fri" };
        }

        int lateCount = 0, earlyExitCount = 0, excessBreakCount = 0;

        foreach (var att in attendanceRecords)
        {
            DateTime attDate = DateTime.MinValue;
            if (att.attendancedate != null)
            {
                if (att.attendancedate is DateOnly dOnly)
                    attDate = dOnly.ToDateTime(TimeOnly.MinValue);
                else
                    attDate = Convert.ToDateTime(att.attendancedate);
            }
            string attDayName = Space.DayOfWeekToShortName(attDate.DayOfWeek);
            if (!salaryWorkingDays.Contains(attDayName, StringComparer.OrdinalIgnoreCase)) continue;

            int lateMinutes = Convert.ToInt32(att.lateminutes ?? 0);
            if (lateMinutes > 5) lateCount++;

            int earlyExitMinutes = Convert.ToInt32(att.earlyexitminutes ?? 0);
            if (earlyExitMinutes > 0) earlyExitCount++;

            decimal breakHours = Convert.ToDecimal(att.breakhours ?? 0);
            if (breakHours > breakTimeLimitHours) excessBreakCount++;
        }

        // Absence calculation using pre-fetched sets from the multi-query
        int absentCount = 0;
        {
            var mStart = new DateTime(year, month, 1);
            var mEnd   = new DateTime(year, month, DateTime.DaysInMonth(year, month));
            if (mEnd > DateTime.Today) mEnd = DateTime.Today;
            if (mStart < empDoj.Date) mStart = empDoj.Date;

            for (var d = mStart; d <= mEnd; d = d.AddDays(1))
            {
                string dayName = Space.DayOfWeekToShortName(d.DayOfWeek);
                if (!salaryWorkingDays.Contains(dayName, StringComparer.OrdinalIgnoreCase)) continue;
                if (attDatesSet.Contains(d.Date))   continue;
                if (leaveDatesSet.Contains(d.Date)) continue;
                absentCount++;
            }
        }

        int pendingTaskCount = 0;
        foreach (var task in taskRecords)
        {
            string tstatus = task.taskstatus?.ToString() ?? "";
            decimal est    = Convert.ToDecimal(task.estimatedhours ?? 8);
            decimal actual = Convert.ToDecimal(task.actualhours ?? 0);

            bool isCompleted = tstatus.Equals("Completed", StringComparison.OrdinalIgnoreCase) ||
                               tstatus.Equals("Complete",  StringComparison.OrdinalIgnoreCase) ||
                               tstatus.Equals("Resolve",   StringComparison.OrdinalIgnoreCase) ||
                               actual >= est;
            if (!isCompleted) pendingTaskCount++;
        }

        // Calibrate penalty rates
        var rates = PenaltyCalibrator.GetCalibratedRates(basic, spaceDeductions);

        var absentDed    = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Absent"       || d.Name.Contains("absent",  StringComparison.OrdinalIgnoreCase) || d.Name.Contains("absence", StringComparison.OrdinalIgnoreCase));
        var lateDed      = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Late"          || d.Name.Contains("late",    StringComparison.OrdinalIgnoreCase));
        var earlyExitDed = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Early Exit"    || d.Name.Contains("early",   StringComparison.OrdinalIgnoreCase));
        var breakDed     = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Excess Break"  || d.Name.Contains("break",   StringComparison.OrdinalIgnoreCase));
        var taskDed      = spaceDeductions.FirstOrDefault(d => d.DeductionType == "Pending Tasks" || d.Name.Contains("task",    StringComparison.OrdinalIgnoreCase) || d.Name.Contains("pending", StringComparison.OrdinalIgnoreCase));

        decimal totalPerformanceDeduction = 0m;

        void ProcessPenalty(Deduction? customDed, string defaultName, decimal defaultValue, int occurrences, decimal rate, string penaltyType)
        {
            decimal amt = occurrences * rate;
            if (amt <= 0m) return;

            string pName = customDed != null ? customDed.Name : defaultName;
            string pType = customDed != null ? customDed.Type : "Fixed";
            decimal pVal = customDed != null ? customDed.Value : defaultValue;

            string rateText = pType.Equals("Percentage", StringComparison.OrdinalIgnoreCase)
                ? $"{pVal:0.##}% of Basic" : $"₹{pVal:0.##}";

            string unitLabel = penaltyType switch
            {
                "Absent"       => occurrences == 1 ? "absence"       : "absences",
                "Late"         => occurrences == 1 ? "late clock-in"  : "late clock-ins",
                "Early Exit"   => occurrences == 1 ? "early exit"     : "early exits",
                "Excess Break" => occurrences == 1 ? "excess break"   : "excess breaks",
                "Pending Tasks"=> occurrences == 1 ? "pending task"   : "pending tasks",
                _ => occurrences == 1 ? "occurrence" : "occurrences"
            };

            responseDeductions.Add(new BreakdownItem
            {
                Name = $"{pName} ({occurrences} {unitLabel}, {rateText} each)",
                Type = pType, Value = pVal, Amount = amt, DeductionType = penaltyType
            });
            totalPerformanceDeduction += amt;
        }

        ProcessPenalty(absentDed,    "Absent Penalty",        1000m, absentCount,      rates.AbsentRate,      "Absent");
        ProcessPenalty(lateDed,      "Late Clock-In Penalty",  200m, lateCount,         rates.LateRate,        "Late");
        ProcessPenalty(earlyExitDed, "Early Exit Penalty",     200m, earlyExitCount,    rates.EarlyExitRate,   "Early Exit");
        ProcessPenalty(breakDed,     "Excess Break Penalty",   150m, excessBreakCount,  rates.ExcessBreakRate, "Excess Break");
        ProcessPenalty(taskDed,      "Pending Tasks Penalty",  500m, pendingTaskCount,  rates.PendingTaskRate, "Pending Tasks");

        decimal gross         = basic + hra + da;
        decimal totalDeductions = pf + tds + totalPerformanceDeduction;
        decimal net           = Math.Max(0m, gross - totalDeductions);

        return new SalaryResponse
        {
            Basic  = basic,
            Hra    = hra,
            Da     = da,
            Gross  = gross,
            Pf     = pf,
            Tds    = tds,
            Net    = net,
            Month  = month,
            Year   = year,
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

    public async Task<IEnumerable<User>> GetCompanyUsersForPayrollAsync(int adminId)
    {
        var query = @"
            SELECT u.empid, u.name, u.spaceid, u.email, u.status, u.role
            FROM t_users u
            INNER JOIN t_spaces s ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId
        ";
        return await _db.QueryAsync<User>(query, new { AdminId = adminId });
    }

    public async Task<bool> CheckIfAlreadyPaidAsync(int empId, int month, int year)
    {
        var query = @"
            SELECT COUNT(1) 
            FROM t_payrollpayments 
            WHERE empid = @EmpId 
              AND EXTRACT(MONTH FROM paidat) = @Month 
              AND EXTRACT(YEAR FROM paidat) = @Year";
        var count = await _db.ExecuteScalarAsync<int>(query, new { EmpId = empId, Month = month, Year = year });
        return count > 0;
    }

    public async Task<int> CreatePayrollPaymentDirectAsync(
        int empId, 
        int spaceId, 
        decimal totalAmount, 
        decimal deduction, 
        decimal finalAmount, 
        decimal allowanceAmount, 
        string paymentMethod, 
        string transactionId)
    {
        var query = @"
            INSERT INTO t_payrollpayments 
                (empid, spaceid, totalamount, deduction, finalamount, status, paidat, createdat, ismanual, allowanceamount, deductionamount, paymentmethod, transactionid)
            VALUES 
                (@EmpId, @SpaceId, @TotalAmount, @Deduction, @FinalAmount, 'Paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE, @AllowanceAmount, @Deduction, @PaymentMethod, @TransactionId)
            RETURNING paymentid;";
        return await _db.ExecuteScalarAsync<int>(query, new
        {
            EmpId = empId,
            SpaceId = spaceId,
            TotalAmount = totalAmount,
            Deduction = deduction,
            FinalAmount = finalAmount,
            AllowanceAmount = allowanceAmount,
            PaymentMethod = paymentMethod,
            TransactionId = transactionId
        });
    }

    public async Task CreatePayslipDirectAsync(
        int empId, 
        int spaceId, 
        decimal baseAmount, 
        decimal deduction, 
        decimal finalAmount, 
        int paymentId, 
        decimal basic, 
        decimal totalAllowance, 
        string breakdown, 
        string paymentMethod, 
        string transactionId)
    {
        var query = @"
            INSERT INTO t_payslips 
                (empid, spaceid, baseamount, deduction, finalamount, type, paymentid, generatedat, basic, totalallowance, totaldeduction, breakdown, paymentmethod, transactionid)
            VALUES 
                (@EmpId, @SpaceId, @BaseAmount, @Deduction, @FinalAmount, 'Payroll', @PaymentId, CURRENT_TIMESTAMP, @Basic, @TotalAllowance, @Deduction, @Breakdown, @PaymentMethod, @TransactionId);";
        
        await _db.ExecuteAsync(query, new
        {
            EmpId = empId,
            SpaceId = spaceId,
            BaseAmount = baseAmount,
            Deduction = deduction,
            FinalAmount = finalAmount,
            PaymentId = paymentId,
            Basic = basic,
            TotalAllowance = totalAllowance,
            Breakdown = breakdown,
            PaymentMethod = paymentMethod,
            TransactionId = transactionId
        });
    }
}
