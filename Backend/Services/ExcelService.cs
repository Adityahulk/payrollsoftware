using System;
using System.IO;
using System.Data;
using System.Threading.Tasks;
using ClosedXML.Excel;
using Dapper;

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

        public ExcelService(IDbConnection db)
        {
            _db = db;
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

        public async Task<byte[]> ExportPayrollReportAsync(int spaceId, int month, int year)
        {
            // ── Sheet 1: Monthly Report ──
            var monthlySql = @"
                SELECT p.paymentid, p.empid, u.name, u.email, 
                       COALESCE(es.basic, 25000) AS basesalary,
                       p.allowanceamount, p.deduction, p.finalamount, p.status, p.paidat,
                       s.spacename
                FROM t_payrollpayments p
                JOIN t_users u ON p.empid = u.empid
                LEFT JOIN t_employeesalary es ON p.empid = es.empid
                LEFT JOIN t_spaces s ON p.spaceid = s.spaceid
                WHERE p.spaceid = @SpaceId 
                  AND EXTRACT(MONTH FROM p.createdat) = @Month 
                  AND EXTRACT(YEAR FROM p.createdat) = @Year
                ORDER BY p.paymentid DESC;";
            var monthlyRecords = await _db.QueryAsync(monthlySql, new { SpaceId = spaceId, Month = month, Year = year });

            // Fetch attendance data for the month
            var attendanceSql = @"
                SELECT u.empid,
                       COUNT(DISTINCT a.attendancedate) AS dayspresent,
                       COALESCE(SUM(a.overtimehours), 0) AS overtimehours
                FROM t_users u
                LEFT JOIN t_attendance a ON u.empid = a.empid
                    AND EXTRACT(MONTH FROM a.attendancedate) = @Month 
                    AND EXTRACT(YEAR FROM a.attendancedate) = @Year
                    AND a.clockin IS NOT NULL
                WHERE u.spaceid = @SpaceId AND u.status != 'Pending'
                GROUP BY u.empid;";
            var attendanceData = (await _db.QueryAsync(attendanceSql, new { SpaceId = spaceId, Month = month, Year = year }))
                .ToDictionary(a => (int)a.empid, a => a);

            // Fetch leaves for the month
            var leavesSql = @"
                SELECT empid, COUNT(*) AS leavecount
                FROM t_leaves
                WHERE spaceid = @SpaceId 
                  AND EXTRACT(MONTH FROM leavedate) = @Month 
                  AND EXTRACT(YEAR FROM leavedate) = @Year
                  AND status = 'Approved'
                GROUP BY empid;";
            var leavesData = (await _db.QueryAsync(leavesSql, new { SpaceId = spaceId, Month = month, Year = year }))
                .ToDictionary(l => (int)l.empid, l => (int)l.leavecount);

            // Fetch allowances for this space
            var allowancesSql = @"SELECT name, type, value FROM t_allowances WHERE spaceid = @SpaceId ORDER BY allowanceid;";
            var allowances = (await _db.QueryAsync(allowancesSql, new { SpaceId = spaceId })).ToList();

            // Fetch deductions for this space
            var deductionsSql = @"SELECT name, type, value FROM t_deductions WHERE spaceid = @SpaceId ORDER BY deductionid;";
            var deductions = (await _db.QueryAsync(deductionsSql, new { SpaceId = spaceId })).ToList();

            // ── Sheet 2: Yearly Summary ──
            var yearlySql = @"
                SELECT p.empid, u.name, u.email,
                       SUM(p.totalamount) AS totalgross,
                       SUM(COALESCE(p.allowanceamount, 0)) AS totalallowances,
                       SUM(p.deduction) AS totaldeductions,
                       SUM(p.finalamount) AS totalnet,
                       COUNT(*) AS monthsprocessed
                FROM t_payrollpayments p
                JOIN t_users u ON p.empid = u.empid
                WHERE p.spaceid = @SpaceId 
                  AND EXTRACT(YEAR FROM p.createdat) = @Year
                  AND p.status = 'Paid'
                GROUP BY p.empid, u.name, u.email
                ORDER BY totalnet DESC;";
            var yearlyRecords = await _db.QueryAsync(yearlySql, new { SpaceId = spaceId, Year = year });

            // Calculate working days for the month
            var daysInMonth = DateTime.DaysInMonth(year, month);
            int totalWorkingDays = 0;
            for (int d = 1; d <= daysInMonth; d++)
            {
                var day = new DateTime(year, month, d).DayOfWeek;
                if (day != DayOfWeek.Sunday) totalWorkingDays++;
            }

            var monthNames = new[] { "", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" };
            var monthName = month >= 1 && month <= 12 ? monthNames[month] : month.ToString();

            using (var workbook = new XLWorkbook())
            {
                // ════════════════════════════════════════════
                //  SHEET 1: Monthly Payroll Report
                // ════════════════════════════════════════════
                var ws1 = workbook.Worksheets.Add("Monthly Report");

                ws1.Cell(1, 1).Value = $"Monthly Payroll Report — {monthName} {year}";
                ws1.Cell(1, 1).Style.Font.Bold = true;
                ws1.Cell(1, 1).Style.Font.FontSize = 16;
                ws1.Cell(1, 1).Style.Font.FontColor = XLColor.White;
                ws1.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#1E293B");
                ws1.Range(1, 1, 1, 14).Merge();
                ws1.Row(1).Height = 30;

                ws1.Cell(2, 1).Value = $"Space ID: #{spaceId} | Working Days: {totalWorkingDays} | Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC";
                ws1.Cell(2, 1).Style.Font.FontSize = 10;
                ws1.Cell(2, 1).Style.Font.FontColor = XLColor.FromHtml("#64748B");
                ws1.Range(2, 1, 2, 14).Merge();

                string[] headers1 = { "Emp ID", "Name", "Email", "Space", "Base Salary",
                    "Total Allowances", "Total Deductions", "Net Salary",
                    "Working Days", "Days Present", "Leaves", "Overtime (hrs)",
                    "Status", "Paid Date" };
                for (int i = 0; i < headers1.Length; i++)
                {
                    var cell = ws1.Cell(4, i + 1);
                    cell.Value = headers1[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#4F46E5");
                    cell.Style.Font.FontColor = XLColor.White;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }

                int row1 = 5;
                foreach (var pay in monthlyRecords)
                {
                    int empId = (int)pay.empid;
                    var att = attendanceData.ContainsKey(empId) ? attendanceData[empId] : null;
                    int leaves = leavesData.ContainsKey(empId) ? leavesData[empId] : 0;

                    ws1.Cell(row1, 1).Value = empId;
                    ws1.Cell(row1, 2).Value = pay.name ?? "";
                    ws1.Cell(row1, 3).Value = pay.email ?? "";
                    ws1.Cell(row1, 4).Value = pay.spacename ?? "";
                    ws1.Cell(row1, 5).Value = (decimal)pay.basesalary;
                    ws1.Cell(row1, 5).Style.NumberFormat.Format = "₹#,##0.00";
                    ws1.Cell(row1, 6).Value = (decimal)(pay.allowanceamount ?? 0m);
                    ws1.Cell(row1, 6).Style.NumberFormat.Format = "₹#,##0.00";
                    ws1.Cell(row1, 7).Value = (decimal)pay.deduction;
                    ws1.Cell(row1, 7).Style.NumberFormat.Format = "₹#,##0.00";
                    ws1.Cell(row1, 8).Value = (decimal)pay.finalamount;
                    ws1.Cell(row1, 8).Style.NumberFormat.Format = "₹#,##0.00";
                    ws1.Cell(row1, 8).Style.Font.Bold = true;
                    ws1.Cell(row1, 9).Value = totalWorkingDays;
                    ws1.Cell(row1, 10).Value = att != null ? (int)att.dayspresent : 0;
                    ws1.Cell(row1, 11).Value = leaves;
                    ws1.Cell(row1, 12).Value = att != null ? (decimal)att.overtimehours : 0m;
                    ws1.Cell(row1, 13).Value = pay.status ?? "";
                    ws1.Cell(row1, 14).Value = pay.paidat != null ? ((DateTime)pay.paidat).ToString("yyyy-MM-dd HH:mm") : "";

                    // Alternate row coloring
                    if (row1 % 2 == 0)
                    {
                        for (int c = 1; c <= 14; c++)
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
                //  SHEET 2: Yearly Summary
                // ════════════════════════════════════════════
                var ws2 = workbook.Worksheets.Add("Yearly Summary");

                ws2.Cell(1, 1).Value = $"Yearly Payroll Summary — {year}";
                ws2.Cell(1, 1).Style.Font.Bold = true;
                ws2.Cell(1, 1).Style.Font.FontSize = 16;
                ws2.Cell(1, 1).Style.Font.FontColor = XLColor.White;
                ws2.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#1E293B");
                ws2.Range(1, 1, 1, 8).Merge();
                ws2.Row(1).Height = 30;

                ws2.Cell(2, 1).Value = $"Space ID: #{spaceId} | Aggregated from all processed months in {year}";
                ws2.Cell(2, 1).Style.Font.FontSize = 10;
                ws2.Cell(2, 1).Style.Font.FontColor = XLColor.FromHtml("#64748B");
                ws2.Range(2, 1, 2, 8).Merge();

                string[] headers2 = { "Emp ID", "Name", "Email", "Total Gross", "Total Allowances", "Total Deductions", "Total Net Paid", "Months Processed" };
                for (int i = 0; i < headers2.Length; i++)
                {
                    var cell = ws2.Cell(4, i + 1);
                    cell.Value = headers2[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#059669");
                    cell.Style.Font.FontColor = XLColor.White;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }

                int row2 = 5;
                foreach (var rec in yearlyRecords)
                {
                    ws2.Cell(row2, 1).Value = (int)rec.empid;
                    ws2.Cell(row2, 2).Value = rec.name ?? "";
                    ws2.Cell(row2, 3).Value = rec.email ?? "";
                    ws2.Cell(row2, 4).Value = (decimal)rec.totalgross;
                    ws2.Cell(row2, 4).Style.NumberFormat.Format = "₹#,##0.00";
                    ws2.Cell(row2, 5).Value = (decimal)rec.totalallowances;
                    ws2.Cell(row2, 5).Style.NumberFormat.Format = "₹#,##0.00";
                    ws2.Cell(row2, 6).Value = (decimal)rec.totaldeductions;
                    ws2.Cell(row2, 6).Style.NumberFormat.Format = "₹#,##0.00";
                    ws2.Cell(row2, 7).Value = (decimal)rec.totalnet;
                    ws2.Cell(row2, 7).Style.NumberFormat.Format = "₹#,##0.00";
                    ws2.Cell(row2, 7).Style.Font.Bold = true;
                    ws2.Cell(row2, 8).Value = (long)rec.monthsprocessed;

                    if (row2 % 2 == 0)
                    {
                        for (int c = 1; c <= 8; c++)
                            ws2.Cell(row2, c).Style.Fill.BackgroundColor = XLColor.FromHtml("#F8FAFC");
                    }
                    row2++;
                }

                ws2.Columns().AdjustToContents();

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
