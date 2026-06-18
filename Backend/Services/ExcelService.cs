using System;
using System.IO;
using System.Data;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using ClosedXML.Excel;
using Dapper;
using Backend.Models;

namespace Backend.Services
{
    public interface IExcelService
    {
        Task<byte[]> ExportEmployeeListAsync(int spaceId);
        Task<byte[]> ExportPayrollReportAsync(int spaceId, int month, int year);
        Task<byte[]> ExportWorklogIntensityAsync(int spaceId, DateTime startDate, DateTime endDate);
    }

    public class ExcelService : IExcelService
    {
        private readonly IDbConnection _db;
        private readonly IPerformanceService _performanceService;

        public ExcelService(IDbConnection db, IPerformanceService performanceService)
        {
            _db = db;
            _performanceService = performanceService;
        }

        private class PerformanceExcelRow
        {
            public string? EmployeeName { get; set; }
            public int TasksCompleted { get; set; }
            public int TasksPending { get; set; }
            public decimal AttendanceScore { get; set; }
            public decimal OverallScore { get; set; }
        }

        public async Task<byte[]> ExportEmployeeListAsync(int spaceId)
        {
            var sql = @"
                SELECT empid, name, email, role, status, dateofjoining, phone, address
                FROM t_users
                WHERE spaceid = @SpaceId AND status != 'Pending'
                ORDER BY empid ASC;";
            var employees = await _db.QueryAsync(sql, new { SpaceId = spaceId });

            using (var workbook = new XLWorkbook())
            {
                var worksheet = workbook.Worksheets.Add("Employees");

                // Title Banner
                worksheet.Cell(1, 1).Value = "Microtechnique Employee Directory";
                worksheet.Cell(1, 1).Style.Font.Bold = true;
                worksheet.Cell(1, 1).Style.Font.FontSize = 16;
                worksheet.Range(1, 1, 1, 8).Merge();

                // Headers
                string[] headers = { "Emp ID", "Name", "Email", "Role", "Status", "Date of Joining", "Phone", "Address" };
                for (int i = 0; i < headers.Length; i++)
                {
                    var cell = worksheet.Cell(3, i + 1);
                    cell.Value = headers[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4F46E5");
                    cell.Style.Font.FontColor = XLColor.White;
                }

                // Data Rows
                int rowIdx = 4;
                foreach (var emp in employees)
                {
                    worksheet.Cell(rowIdx, 1).Value = emp.empid;
                    worksheet.Cell(rowIdx, 2).Value = emp.name ?? "";
                    worksheet.Cell(rowIdx, 3).Value = emp.email ?? "";
                    worksheet.Cell(rowIdx, 4).Value = emp.role ?? "";
                    worksheet.Cell(rowIdx, 5).Value = emp.status ?? "";
                    worksheet.Cell(rowIdx, 6).Value = emp.dateofjoining != null ? ((DateTime)emp.dateofjoining).ToString("yyyy-MM-dd") : "";
                    worksheet.Cell(rowIdx, 7).Value = emp.phone ?? "";
                    worksheet.Cell(rowIdx, 8).Value = emp.address ?? "";
                    rowIdx++;
                }

                worksheet.Columns().AdjustToContents();

                using (var stream = new MemoryStream())
                {
                    workbook.SaveAs(stream);
                    return stream.ToArray();
                }
            }
        }

        private static string GetColLetter(int colNum)
        {
            int temp;
            string colLetter = string.Empty;
            while (colNum > 0)
            {
                temp = (colNum - 1) % 26;
                colLetter = (char)(65 + temp) + colLetter;
                colNum = (colNum - temp - 1) / 26;
            }
            return colLetter;
        }

        public async Task<byte[]> ExportPayrollReportAsync(int spaceId, int month, int year)
        {
            // Trigger pre-calculation/sync of performance records for all active staff in the space
            await _performanceService.GetSpacePerformanceAsync(spaceId, month, year);

            // Fetch space configurations (workingdays and breaktime)
            var spaceConfigSql = @"SELECT workingdays, breaktime FROM t_spaces WHERE spaceid = @SpaceId;";
            var spaceConfig = await _db.QueryFirstOrDefaultAsync(spaceConfigSql, new { SpaceId = spaceId });
            
            List<string> salaryWorkingDays = null;
            int breaktimeMinutes = 60;
            if (spaceConfig != null)
            {
                string wdRaw = spaceConfig.workingdays;
                if (!string.IsNullOrWhiteSpace(wdRaw))
                {
                    try { salaryWorkingDays = JsonSerializer.Deserialize<List<string>>(wdRaw); }
                    catch { }
                }
                breaktimeMinutes = spaceConfig.breaktime ?? 60;
            }
            if (salaryWorkingDays == null || salaryWorkingDays.Count == 0)
            {
                salaryWorkingDays = new List<string> { "Mon","Tue","Wed","Thu","Fri" };
            }
            decimal breakTimeLimitHours = breaktimeMinutes / 60.0m;

            // ── Sheet 1: Payroll Data ──
            var monthlySql = @"
                SELECT p.paymentid, p.empid, u.name, u.email, 
                       COALESCE(es.basic, 25000) AS basesalary,
                       p.allowanceamount, p.deduction, p.finalamount, p.status, p.paidat,
                       s.spacename,
                       ps.breakdown
                FROM t_payrollpayments p
                JOIN t_users u ON p.empid = u.empid
                LEFT JOIN t_employeesalary es ON p.empid = es.empid
                LEFT JOIN t_spaces s ON p.spaceid = s.spaceid
                LEFT JOIN t_payslips ps ON p.paymentid = ps.paymentid
                WHERE p.spaceid = @SpaceId 
                  AND EXTRACT(MONTH FROM p.createdat) = @Month 
                  AND EXTRACT(YEAR FROM p.createdat) = @Year
                ORDER BY p.paymentid DESC;";
            var monthlyRecords = (await _db.QueryAsync(monthlySql, new { SpaceId = spaceId, Month = month, Year = year })).ToList();

            // Fetch attendance data for the month
            var attendanceDetailsSql = @"
                SELECT a.empid, a.attendancedate, a.lateminutes, a.earlyexitminutes, a.breakhours, a.overtimehours
                FROM t_attendance a
                JOIN t_users u ON a.empid = u.empid
                WHERE u.spaceid = @SpaceId AND u.status != 'Pending'
                  AND EXTRACT(MONTH FROM a.attendancedate) = @Month
                  AND EXTRACT(YEAR FROM a.attendancedate) = @Year
                  AND a.clockin IS NOT NULL;";
            var attendanceRecords = (await _db.QueryAsync(attendanceDetailsSql, new { SpaceId = spaceId, Month = month, Year = year })).ToList();
            var attendanceByEmp = attendanceRecords
                .GroupBy(a => (int)a.empid)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Fetch leaves for the month
            var leavesDetailsSql = @"
                SELECT empid, leavedate
                FROM t_leaves
                WHERE spaceid = @SpaceId 
                  AND EXTRACT(MONTH FROM leavedate) = @Month 
                  AND EXTRACT(YEAR FROM leavedate) = @Year
                  AND status = 'Approved';";
            var leavesRecords = (await _db.QueryAsync(leavesDetailsSql, new { SpaceId = spaceId, Month = month, Year = year })).ToList();
            var leavesByEmp = leavesRecords
                .GroupBy(l => (int)l.empid)
                .ToDictionary(g => g.Key, g => g.Select(l => (DateTime)l.leavedate).ToHashSet());

            // Fetch users for their DOJ & Role fallback
            var usersSql = @"
                SELECT empid, dateofjoining, role
                FROM t_users
                WHERE spaceid = @SpaceId AND status != 'Pending';";
            var usersData = (await _db.QueryAsync(usersSql, new { SpaceId = spaceId }))
                .ToDictionary(u => (int)u.empid, u => u);

            // Fetch allowances for this space
            var allowancesSql = @"SELECT name, type, value FROM t_allowances WHERE spaceid = @SpaceId ORDER BY allowanceid;";
            var allowances = (await _db.QueryAsync(allowancesSql, new { SpaceId = spaceId })).ToList();

            // Fetch deductions for this space
            var deductionsSql = @"SELECT name, type, value FROM t_deductions WHERE spaceid = @SpaceId ORDER BY deductionid;";
            var deductions = (await _db.QueryAsync(deductionsSql, new { SpaceId = spaceId })).ToList();

            var allowanceNames = new List<string> { "HRA", "DA" };
            foreach (var a in allowances)
            {
                string name = (string)a.name;
                if (!allowanceNames.Contains(name, StringComparer.OrdinalIgnoreCase))
                {
                    allowanceNames.Add(name);
                }
            }

            var spaceDeductionsNames = new List<string>();
            foreach (var d in deductions)
            {
                string name = (string)d.name;
                string type = (string)(d.deductiontype ?? "");
                bool isPenalty = type.Equals("Absent", StringComparison.OrdinalIgnoreCase) ||
                                 type.Equals("Late", StringComparison.OrdinalIgnoreCase) ||
                                 type.Equals("Early Exit", StringComparison.OrdinalIgnoreCase) ||
                                 type.Equals("Excess Break", StringComparison.OrdinalIgnoreCase) ||
                                 type.Equals("Pending Tasks", StringComparison.OrdinalIgnoreCase) ||
                                 name.Contains("absent", StringComparison.OrdinalIgnoreCase) ||
                                 name.Contains("absence", StringComparison.OrdinalIgnoreCase) ||
                                 name.Contains("late", StringComparison.OrdinalIgnoreCase) ||
                                 name.Contains("early", StringComparison.OrdinalIgnoreCase) ||
                                 name.Contains("break", StringComparison.OrdinalIgnoreCase) ||
                                 name.Contains("task", StringComparison.OrdinalIgnoreCase) ||
                                 name.Contains("pending", StringComparison.OrdinalIgnoreCase);

                if (!isPenalty && 
                    !name.Equals("PF", StringComparison.OrdinalIgnoreCase) && 
                    !name.Contains("Provident", StringComparison.OrdinalIgnoreCase) && 
                    !name.Equals("TDS", StringComparison.OrdinalIgnoreCase) && 
                    !name.Contains("Tax", StringComparison.OrdinalIgnoreCase))
                {
                    spaceDeductionsNames.Add(name);
                }
            }

            // Assemble Columns
            var columns = new List<string> { "Emp ID", "Name", "Email", "Space", "Base Salary" };
            
            // Allowances
            int firstAllowanceCol = 6;
            var allowanceCols = new List<string> { "HRA", "DA" };
            foreach (var name in allowanceNames)
            {
                if (!name.Equals("HRA", StringComparison.OrdinalIgnoreCase) && !name.Equals("DA", StringComparison.OrdinalIgnoreCase))
                {
                    allowanceCols.Add(name);
                }
            }
            columns.AddRange(allowanceCols);
            columns.Add("Total Allowances");
            int totalAllowancesColIdx = columns.Count; // 1-indexed

            // Deductions
            int firstDeductionCol = totalAllowancesColIdx + 1;
            var deductionCols = new List<string> { "PF", "TDS", "Absent Penalty", "Late Penalty", "Early Exit Penalty", "Excess Break Penalty", "Pending Tasks Penalty" };
            foreach (var name in spaceDeductionsNames)
            {
                deductionCols.Add(name);
            }
            columns.AddRange(deductionCols);
            columns.Add("Total Deductions");
            int totalDeductionsColIdx = columns.Count; // 1-indexed

            columns.Add("Net Salary");
            int netSalaryColIdx = columns.Count; // 1-indexed

            columns.Add("Working Days");
            columns.Add("Days Present");
            columns.Add("Absent Days");
            columns.Add("Leaves");
            columns.Add("Late Days");
            columns.Add("Early Exits");
            columns.Add("Overtime (hrs)");
            columns.Add("Status");
            columns.Add("Paid Date");

            // ── Sheet 2: Performance Data ──
            var performanceSql = @"
                SELECT COALESCE(u.name, u.email) AS EmployeeName, 
                       p.tasks_completed AS TasksCompleted, 
                       p.tasks_pending AS TasksPending, 
                       p.attendance_score AS AttendanceScore, 
                       p.overall_score AS OverallScore
                FROM t_employee_performance p
                INNER JOIN t_users u ON p.empid = u.empid
                WHERE p.spaceid = @SpaceId AND p.month = @Month AND p.year = @Year
                ORDER BY p.overall_score DESC;";
            var performanceRecords = (await _db.QueryAsync<PerformanceExcelRow>(performanceSql, new { SpaceId = spaceId, Month = month, Year = year })).ToList();

            // Calculate working days for the month
            int totalWorkingDays = 0;
            var daysInMonth = DateTime.DaysInMonth(year, month);
            for (int d = 1; d <= daysInMonth; d++)
            {
                var dt = new DateTime(year, month, d);
                string dayName = Space.DayOfWeekToShortName(dt.DayOfWeek);
                if (salaryWorkingDays.Contains(dayName, StringComparer.OrdinalIgnoreCase))
                {
                    totalWorkingDays++;
                }
            }

            var monthNames = new[] { "", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" };
            var monthName = month >= 1 && month <= 12 ? monthNames[month] : month.ToString();

            using (var workbook = new XLWorkbook())
            {
                // ════════════════════════════════════════════
                //  SHEET 1: Payroll
                // ════════════════════════════════════════════
                var ws1 = workbook.Worksheets.Add("Payroll");

                ws1.Cell(1, 1).Value = $"Monthly Payroll Report — {monthName} {year}";
                ws1.Cell(1, 1).Style.Font.Bold = true;
                ws1.Cell(1, 1).Style.Font.FontSize = 16;
                ws1.Cell(1, 1).Style.Font.FontColor = XLColor.White;
                ws1.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#1E293B");
                ws1.Range(1, 1, 1, columns.Count).Merge();
                ws1.Row(1).Height = 30;

                ws1.Cell(2, 1).Value = $"Space ID: #{spaceId} | Working Days: {totalWorkingDays} | Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC";
                ws1.Cell(2, 1).Style.Font.FontSize = 10;
                ws1.Cell(2, 1).Style.Font.FontColor = XLColor.FromHtml("#64748B");
                ws1.Range(2, 1, 2, columns.Count).Merge();

                for (int i = 0; i < columns.Count; i++)
                {
                    var cell = ws1.Cell(4, i + 1);
                    cell.Value = columns[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4F46E5");
                    cell.Style.Font.FontColor = XLColor.White;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }

                int row1 = 5;
                foreach (var pay in monthlyRecords)
                {
                    int empId = (int)pay.empid;
                    
                    // Detailed attendance metrics calculation
                    var attList = attendanceByEmp.ContainsKey(empId) ? attendanceByEmp[empId] : new List<dynamic>();
                    var attDatesSet = attList.Select(a => ((DateTime)a.attendancedate).Date).ToHashSet();
                    var leaveDatesSet = leavesByEmp.ContainsKey(empId) ? leavesByEmp[empId] : new HashSet<DateTime>();

                    int daysPresent = attDatesSet.Count;
                    decimal overtimeHours = attList.Sum(a => (decimal)a.overtimehours);
                    int leaves = leaveDatesSet.Count;

                    int lateDays = 0;
                    int earlyExits = 0;
                    foreach (var att in attList)
                    {
                        int lateMinutes = Convert.ToInt32(att.lateminutes ?? 0);
                        if (lateMinutes > 5) lateDays++;

                        int earlyExitMinutes = Convert.ToInt32(att.earlyexitminutes ?? 0);
                        if (earlyExitMinutes > 0) earlyExits++;
                    }

                    int absentDays = 0;
                    var empRow = usersData.ContainsKey(empId) ? usersData[empId] : null;
                    DateTime empDoj = new DateTime(year, month, 1);
                    if (empRow != null)
                    {
                        var rowDict = empRow as IDictionary<string, object>;
                        if (rowDict != null && rowDict.TryGetValue("dateofjoining", out var dojVal) && dojVal != null)
                        {
                            empDoj = Convert.ToDateTime(dojVal);
                        }
                    }

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
                        absentDays++;
                    }

                    // Parse breakdown JSON
                    decimal baseSalary = (decimal)pay.basesalary;
                    decimal hraVal = 0m;
                    decimal daVal = 0m;
                    
                    var allowanceVals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                    var deductionVals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                    
                    if (pay.breakdown != null && !string.IsNullOrWhiteSpace((string)pay.breakdown))
                    {
                        try
                        {
                            using (var doc = JsonDocument.Parse((string)pay.breakdown))
                            {
                                var root = doc.RootElement;
                                if (root.TryGetProperty("basic", out var basicProp))
                                {
                                    baseSalary = basicProp.GetDecimal();
                                }
                                if (root.TryGetProperty("hra", out var hraProp))
                                {
                                    hraVal = hraProp.GetDecimal();
                                }
                                if (root.TryGetProperty("da", out var daProp))
                                {
                                    daVal = daProp.GetDecimal();
                                }
                                
                                if (root.TryGetProperty("allowances", out var allowancesProp) && allowancesProp.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var allowance in allowancesProp.EnumerateArray())
                                    {
                                        if (allowance.TryGetProperty("name", out var nameProp) && allowance.TryGetProperty("amount", out var amountProp))
                                        {
                                            string allowanceName = nameProp.GetString() ?? "";
                                            decimal amt = amountProp.GetDecimal();
                                            allowanceVals[allowanceName] = amt;
                                        }
                                    }
                                }

                                if (root.TryGetProperty("deductions", out var deductionsProp) && deductionsProp.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var deduction in deductionsProp.EnumerateArray())
                                    {
                                        if (deduction.TryGetProperty("name", out var nameProp) && deduction.TryGetProperty("amount", out var amountProp))
                                        {
                                            string deductionName = nameProp.GetString() ?? "";
                                            decimal amt = amountProp.GetDecimal();
                                            deductionVals[deductionName] = amt;
                                        }
                                    }
                                }

                                if (root.TryGetProperty("penalties", out var penaltiesProp) && penaltiesProp.ValueKind == JsonValueKind.Array)
                                {
                                    foreach (var penalty in penaltiesProp.EnumerateArray())
                                    {
                                        if (penalty.TryGetProperty("name", out var nameProp) && penalty.TryGetProperty("amount", out var amountProp))
                                        {
                                            string penaltyName = nameProp.GetString() ?? "";
                                            decimal amt = amountProp.GetDecimal();
                                            
                                            string deductionType = "";
                                            if (penalty.TryGetProperty("deductionType", out var typeProp))
                                            {
                                                deductionType = typeProp.GetString() ?? "";
                                            }
                                            
                                            if (deductionType.Equals("Absent", StringComparison.OrdinalIgnoreCase) || penaltyName.StartsWith("Absent", StringComparison.OrdinalIgnoreCase))
                                            {
                                                deductionVals["Absent Penalty"] = amt;
                                            }
                                            else if (deductionType.Equals("Late", StringComparison.OrdinalIgnoreCase) || penaltyName.StartsWith("Late", StringComparison.OrdinalIgnoreCase))
                                            {
                                                deductionVals["Late Penalty"] = amt;
                                            }
                                            else if (deductionType.Equals("Early Exit", StringComparison.OrdinalIgnoreCase) || penaltyName.StartsWith("Early", StringComparison.OrdinalIgnoreCase))
                                            {
                                                deductionVals["Early Exit Penalty"] = amt;
                                            }
                                            else if (deductionType.Equals("Excess Break", StringComparison.OrdinalIgnoreCase) || penaltyName.StartsWith("Excess", StringComparison.OrdinalIgnoreCase))
                                            {
                                                deductionVals["Excess Break Penalty"] = amt;
                                            }
                                            else if (deductionType.Equals("Pending Tasks", StringComparison.OrdinalIgnoreCase) || penaltyName.StartsWith("Pending", StringComparison.OrdinalIgnoreCase))
                                            {
                                                deductionVals["Pending Tasks Penalty"] = amt;
                                            }
                                            else
                                            {
                                                deductionVals[penaltyName] = amt;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error parsing payslip breakdown for payment {pay.paymentid}: {ex.Message}");
                        }
                    }

                    if (allowanceVals.Count == 0 && deductionVals.Count == 0)
                    {
                        string role = empRow != null ? (string)(empRow.role ?? "") : "";
                        hraVal = role switch
                        {
                            "Admin" => 25000m, "Manager" => 18000m, "TeamLead" => 15000m, _ => 10000m
                        };
                        daVal = role switch
                        {
                            "Admin" => 10000m, "Manager" => 7000m, "TeamLead" => 5000m, _ => 3000m
                        };
                        
                        allowanceVals["HRA"] = hraVal;
                        allowanceVals["DA"] = daVal;
                        
                        decimal pfVal = Math.Round(baseSalary * 0.12m, 2);
                        decimal tdsVal = Math.Round((baseSalary + hraVal + daVal) * 0.08m, 2);
                        deductionVals["PF"] = pfVal;
                        deductionVals["TDS"] = tdsVal;
                        
                        decimal remainingDeduction = (decimal)pay.deduction - pfVal - tdsVal;
                        if (remainingDeduction > 0)
                        {
                            deductionVals["Absent Penalty"] = remainingDeduction;
                        }
                    }

                    ws1.Cell(row1, 1).Value = empId;
                    ws1.Cell(row1, 2).Value = pay.name ?? "";
                    ws1.Cell(row1, 3).Value = pay.email ?? "";
                    ws1.Cell(row1, 4).Value = pay.spacename ?? "";
                    ws1.Cell(row1, 5).Value = baseSalary;
                    ws1.Cell(row1, 5).Style.NumberFormat.Format = "₹#,##0.00";

                    // Allowances columns
                    int colIdx = 6;
                    foreach (var colName in allowanceCols)
                    {
                        decimal val = 0m;
                        if (colName.Equals("HRA", StringComparison.OrdinalIgnoreCase)) val = hraVal;
                        else if (colName.Equals("DA", StringComparison.OrdinalIgnoreCase)) val = daVal;
                        else allowanceVals.TryGetValue(colName, out val);
                        
                        ws1.Cell(row1, colIdx).Value = val;
                        ws1.Cell(row1, colIdx).Style.NumberFormat.Format = "₹#,##0.00";
                        colIdx++;
                    }

                    // Total Allowances (Formula)
                    string totalAllowancesFormula = $"SUM({GetColLetter(firstAllowanceCol)}{row1}:{GetColLetter(totalAllowancesColIdx - 1)}{row1})";
                    ws1.Cell(row1, totalAllowancesColIdx).FormulaA1 = totalAllowancesFormula;
                    ws1.Cell(row1, totalAllowancesColIdx).Style.NumberFormat.Format = "₹#,##0.00";
                    ws1.Cell(row1, totalAllowancesColIdx).Style.Font.Bold = true;

                    // Deductions columns
                    colIdx = firstDeductionCol;
                    foreach (var colName in deductionCols)
                    {
                        decimal val = 0m;
                        deductionVals.TryGetValue(colName, out val);
                        
                        ws1.Cell(row1, colIdx).Value = val;
                        ws1.Cell(row1, colIdx).Style.NumberFormat.Format = "₹#,##0.00";
                        colIdx++;
                    }

                    // Total Deductions (Formula)
                    string totalDeductionsFormula = $"SUM({GetColLetter(firstDeductionCol)}{row1}:{GetColLetter(totalDeductionsColIdx - 1)}{row1})";
                    ws1.Cell(row1, totalDeductionsColIdx).FormulaA1 = totalDeductionsFormula;
                    ws1.Cell(row1, totalDeductionsColIdx).Style.NumberFormat.Format = "₹#,##0.00";
                    ws1.Cell(row1, totalDeductionsColIdx).Style.Font.Bold = true;

                    // Net Salary (Formula)
                    string netSalaryFormula = $"E{row1}+{GetColLetter(totalAllowancesColIdx)}{row1}-{GetColLetter(totalDeductionsColIdx)}{row1}";
                    ws1.Cell(row1, netSalaryColIdx).FormulaA1 = netSalaryFormula;
                    ws1.Cell(row1, netSalaryColIdx).Style.NumberFormat.Format = "₹#,##0.00";
                    ws1.Cell(row1, netSalaryColIdx).Style.Font.Bold = true;

                    // Attendance details
                    colIdx = netSalaryColIdx + 1;
                    ws1.Cell(row1, colIdx++).Value = totalWorkingDays;
                    ws1.Cell(row1, colIdx++).Value = daysPresent;
                    ws1.Cell(row1, colIdx++).Value = absentDays;
                    ws1.Cell(row1, colIdx++).Value = leaves;
                    ws1.Cell(row1, colIdx++).Value = lateDays;
                    ws1.Cell(row1, colIdx++).Value = earlyExits;
                    ws1.Cell(row1, colIdx++).Value = overtimeHours;
                    ws1.Cell(row1, colIdx++).Value = pay.status ?? "";
                    ws1.Cell(row1, colIdx++).Value = pay.paidat != null ? ((DateTime)pay.paidat).ToString("yyyy-MM-dd HH:mm") : "";

                    // Alternate row coloring
                    if (row1 % 2 == 0)
                    {
                        for (int c = 1; c <= columns.Count; c++)
                            ws1.Cell(row1, c).Style.Fill.BackgroundColor = XLColor.FromHtml("#F8FAFC");
                    }
                    row1++;
                }

                // Allowances breakdown section
                if (allowances.Count > 0)
                {
                    row1 += 2;
                    ws1.Cell(row1, 1).Value = "Space Allowances Configuration";
                    ws1.Cell(row1, 1).Style.Font.Bold = true;
                    ws1.Cell(row1, 1).Style.Font.FontSize = 12;
                    ws1.Range(row1, 1, row1, 4).Merge();
                    row1++;
                    ws1.Cell(row1, 1).Value = "Name"; ws1.Cell(row1, 1).Style.Font.Bold = true;
                    ws1.Cell(row1, 2).Value = "Type"; ws1.Cell(row1, 2).Style.Font.Bold = true;
                    ws1.Cell(row1, 3).Value = "Value"; ws1.Cell(row1, 3).Style.Font.Bold = true;
                    row1++;
                    foreach (var a in allowances)
                    {
                        ws1.Cell(row1, 1).Value = (string)(a.name ?? "");
                        ws1.Cell(row1, 2).Value = (string)(a.type ?? "");
                        ws1.Cell(row1, 3).Value = (decimal)a.value;
                        row1++;
                    }
                }

                // Deductions breakdown section
                if (deductions.Count > 0)
                {
                    row1 += 1;
                    ws1.Cell(row1, 1).Value = "Space Deductions Configuration";
                    ws1.Cell(row1, 1).Style.Font.Bold = true;
                    ws1.Cell(row1, 1).Style.Font.FontSize = 12;
                    ws1.Range(row1, 1, row1, 4).Merge();
                    row1++;
                    ws1.Cell(row1, 1).Value = "Name"; ws1.Cell(row1, 1).Style.Font.Bold = true;
                    ws1.Cell(row1, 2).Value = "Type"; ws1.Cell(row1, 2).Style.Font.Bold = true;
                    ws1.Cell(row1, 3).Value = "Value"; ws1.Cell(row1, 3).Style.Font.Bold = true;
                    row1++;
                    foreach (var d in deductions)
                    {
                        ws1.Cell(row1, 1).Value = (string)(d.name ?? "");
                        ws1.Cell(row1, 2).Value = (string)(d.type ?? "");
                        ws1.Cell(row1, 3).Value = (decimal)d.value;
                        row1++;
                    }
                }

                ws1.Columns().AdjustToContents();

                // ════════════════════════════════════════════
                //  SHEET 2: Performance
                // ════════════════════════════════════════════
                var ws2 = workbook.Worksheets.Add("Performance");

                ws2.Cell(1, 1).Value = $"Employee Performance Report — {monthName} {year}";
                ws2.Cell(1, 1).Style.Font.Bold = true;
                ws2.Cell(1, 1).Style.Font.FontSize = 16;
                ws2.Cell(1, 1).Style.Font.FontColor = XLColor.White;
                ws2.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#1E293B");
                ws2.Range(1, 1, 1, 5).Merge();
                ws2.Row(1).Height = 30;

                ws2.Cell(2, 1).Value = $"Space ID: #{spaceId} | Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC";
                ws2.Cell(2, 1).Style.Font.FontSize = 10;
                ws2.Cell(2, 1).Style.Font.FontColor = XLColor.FromHtml("#64748B");
                ws2.Range(2, 1, 2, 5).Merge();

                string[] headers2 = { "Employee Name", "Tasks Completed", "Tasks Pending", "Attendance %", "Score" };
                for (int i = 0; i < headers2.Length; i++)
                {
                    var cell = ws2.Cell(4, i + 1);
                    cell.Value = headers2[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F766E"); // Teal 700
                    cell.Style.Font.FontColor = XLColor.White;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }

                int row2 = 5;
                foreach (var perf in performanceRecords)
                {
                    ws2.Cell(row2, 1).Value = perf.EmployeeName ?? "";
                    ws2.Cell(row2, 2).Value = perf.TasksCompleted;
                    ws2.Cell(row2, 3).Value = perf.TasksPending;
                    ws2.Cell(row2, 4).Value = perf.AttendanceScore / 100m;
                    ws2.Cell(row2, 4).Style.NumberFormat.Format = "0.0%";
                    ws2.Cell(row2, 5).Value = perf.OverallScore;
                    ws2.Cell(row2, 5).Style.NumberFormat.Format = "0.00";
                    ws2.Cell(row2, 5).Style.Font.Bold = true;

                    // Alignments
                    ws2.Cell(row2, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
                    ws2.Cell(row2, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws2.Cell(row2, 3).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    ws2.Cell(row2, 4).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                    ws2.Cell(row2, 5).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

                    // Alternate row coloring
                    if (row2 % 2 == 0)
                    {
                        for (int c = 1; c <= 5; c++)
                            ws2.Cell(row2, c).Style.Fill.BackgroundColor = XLColor.FromHtml("#F8FAFC");
                    }
                    row2++;
                }

                ws2.Columns().AdjustToContents();

                // ════════════════════════════════════════════
                //  SHEET 3: Summary
                // ════════════════════════════════════════════
                var ws3 = workbook.Worksheets.Add("Summary");

                ws3.Cell(1, 1).Value = $"Executive Summary — {monthName} {year}";
                ws3.Cell(1, 1).Style.Font.Bold = true;
                ws3.Cell(1, 1).Style.Font.FontSize = 16;
                ws3.Cell(1, 1).Style.Font.FontColor = XLColor.White;
                ws3.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#1E293B");
                ws3.Range(1, 1, 1, 2).Merge();
                ws3.Row(1).Height = 30;

                ws3.Cell(2, 1).Value = $"Space ID: #{spaceId} | Summary of Payroll and Performance Metrics";
                ws3.Cell(2, 1).Style.Font.FontSize = 10;
                ws3.Cell(2, 1).Style.Font.FontColor = XLColor.FromHtml("#64748B");
                ws3.Range(2, 1, 2, 2).Merge();

                // Calculations
                decimal totalSalaryPaid = monthlyRecords.Sum(r => (decimal)r.finalamount);
                decimal averagePerformanceScore = performanceRecords.Any() 
                    ? performanceRecords.Average(r => r.OverallScore) 
                    : 0m;
                
                string topPerformer = "N/A";
                if (performanceRecords.Any())
                {
                    var top = performanceRecords.First();
                    topPerformer = $"{top.EmployeeName} ({top.OverallScore:0.00})";
                }

                // Table Headers
                var metricHeader = ws3.Cell(4, 1);
                metricHeader.Value = "Key Metric";
                metricHeader.Style.Font.Bold = true;
                metricHeader.Style.Fill.BackgroundColor = XLColor.FromHtml("#4338CA"); // Indigo 700
                metricHeader.Style.Font.FontColor = XLColor.White;

                var valueHeader = ws3.Cell(4, 2);
                valueHeader.Value = "Value";
                valueHeader.Style.Font.Bold = true;
                valueHeader.Style.Fill.BackgroundColor = XLColor.FromHtml("#4338CA");
                valueHeader.Style.Font.FontColor = XLColor.White;
                valueHeader.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

                // Total Salary Paid
                ws3.Cell(5, 1).Value = "Total Salary Paid";
                ws3.Cell(5, 1).Style.Font.Bold = true;
                ws3.Cell(5, 2).Value = totalSalaryPaid;
                ws3.Cell(5, 2).Style.NumberFormat.Format = "₹#,##0.00";
                ws3.Cell(5, 2).Style.Font.Bold = true;
                ws3.Cell(5, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

                // Average Performance Score
                ws3.Cell(6, 1).Value = "Average Performance Score";
                ws3.Cell(6, 1).Style.Font.Bold = true;
                ws3.Cell(6, 2).Value = averagePerformanceScore;
                ws3.Cell(6, 2).Style.NumberFormat.Format = "0.00";
                ws3.Cell(6, 2).Style.Font.Bold = true;
                ws3.Cell(6, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

                // Top Performer
                ws3.Cell(7, 1).Value = "Top Performer";
                ws3.Cell(7, 1).Style.Font.Bold = true;
                ws3.Cell(7, 2).Value = topPerformer;
                ws3.Cell(7, 2).Style.Font.Bold = true;
                ws3.Cell(7, 2).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

                // Apply borders around the summary card
                var range = ws3.Range(4, 1, 7, 2);
                range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                range.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

                ws3.Columns().AdjustToContents();

                using (var stream = new MemoryStream())
                {
                    workbook.SaveAs(stream);
                    return stream.ToArray();
                }
            }
        }

        public async Task<byte[]> ExportWorklogIntensityAsync(int spaceId, DateTime startDate, DateTime endDate)
        {
            var sql = @"
                SELECT u.empid, u.name, u.email, 
                       COALESCE(SUM(w.hoursworked), 0) AS totalhours,
                       COUNT(DISTINCT w.taskid) AS taskcount,
                       CASE WHEN COUNT(DISTINCT w.taskid) > 0 
                            THEN ROUND(SUM(w.hoursworked) / COUNT(DISTINCT w.taskid), 2)
                            ELSE 0 
                       END AS averagehourspertask
                FROM t_users u
                LEFT JOIN t_worklogs w ON u.empid = w.empid AND w.workdate BETWEEN @Start AND @End
                WHERE u.spaceid = @SpaceId AND u.status = 'Active'
                GROUP BY u.empid, u.name, u.email
                ORDER BY totalhours DESC;";
            var logs = await _db.QueryAsync(sql, new { SpaceId = spaceId, Start = startDate, End = endDate });

            using (var workbook = new XLWorkbook())
            {
                var worksheet = workbook.Worksheets.Add("Intensity Report");

                worksheet.Cell(1, 1).Value = $"Worklog Intensity - Space #{spaceId} ({startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd})";
                worksheet.Cell(1, 1).Style.Font.Bold = true;
                worksheet.Cell(1, 1).Style.Font.FontSize = 14;
                worksheet.Range(1, 1, 1, 6).Merge();

                string[] headers = { "Emp ID", "Name", "Email", "Total Hours Logged", "Unique Tasks Worked On", "Average Hours/Task" };
                for (int i = 0; i < headers.Length; i++)
                {
                    var cell = worksheet.Cell(3, i + 1);
                    cell.Value = headers[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#DC2626");
                    cell.Style.Font.FontColor = XLColor.White;
                }

                int rowIdx = 4;
                foreach (var log in logs)
                {
                    worksheet.Cell(rowIdx, 1).Value = log.empid;
                    worksheet.Cell(rowIdx, 2).Value = log.name ?? "";
                    worksheet.Cell(rowIdx, 3).Value = log.email ?? "";
                    worksheet.Cell(rowIdx, 4).Value = (decimal)log.totalhours;
                    worksheet.Cell(rowIdx, 5).Value = Convert.ToInt32(log.taskcount);
                    worksheet.Cell(rowIdx, 6).Value = (decimal)log.averagehourspertask;
                    rowIdx++;
                }

                worksheet.Columns().AdjustToContents();

                using (var stream = new MemoryStream())
                {
                    workbook.SaveAs(stream);
                    return stream.ToArray();
                }
            }
        }
    }
}
