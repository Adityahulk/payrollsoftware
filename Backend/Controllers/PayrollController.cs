namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using System;
using System.Linq;
using System.Collections.Generic;
using Backend.Services;
using Backend.Models;
using Dapper;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PayrollController : ControllerBase
{
    private readonly ISalaryService _salaryService;
    private readonly IExcelService _excelService;
    private readonly System.Data.IDbConnection _db;

    public PayrollController(ISalaryService salaryService, IExcelService excelService, System.Data.IDbConnection db)
    {
        _salaryService = salaryService;
        _excelService = excelService;
        _db = db;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private int GetSpaceId()
    {
        var claim = User.FindFirst("SpaceId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    // GET /api/payroll/history — real payment records from t_payrollpayments
    [HttpGet("history")]
    public async Task<IActionResult> GetPaymentHistory([FromQuery] int limit = 12)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            var spaceId = GetSpaceId();
            var role = GetRole();

            var payments = await _salaryService.GetPaymentHistoryAsync(empId, limit, spaceId, role);
            return Ok(payments);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PayrollController] Error in GetPaymentHistory: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving payment history.", error = ex.Message });
        }
    }

    // GET /api/payroll/ctc-summary?year=2026 — backend-calculated annual CTC
    [HttpGet("ctc-summary")]
    public async Task<IActionResult> GetCtcSummary([FromQuery] int year = 0)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            if (year == 0) year = DateTime.UtcNow.Year;

            var spaceId = GetSpaceId();
            var role = GetRole();

            var summary = await _salaryService.GetCtcSummaryAsync(empId, year, spaceId, role);
            return Ok(summary);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PayrollController] Error in GetCtcSummary: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving CTC summary.", error = ex.Message });
        }
    }

    // GET /api/payroll/myslips — employee's own payslips from t_payslips
    [HttpGet("myslips")]
    public async Task<IActionResult> GetMyPayslips([FromQuery] int limit = 24)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            var spaceId = GetSpaceId();
            var role = GetRole();

            var slips = await _salaryService.GetMyPayslipsAsync(empId, limit, spaceId, role);
            return Ok(slips);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PayrollController] Error in GetMyPayslips: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving payslips.", error = ex.Message });
        }
    }

    // GET /api/payroll/full/{empId}?month=5&year=2026 — Consolidated payroll structure, history, and work impact stats
    [HttpGet("full/{empId:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetFullPayrollDetails(int empId, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        try
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var spaceId = GetSpaceId();
            var role = GetRole();

            var salary = await _salaryService.GetSalaryAsync(empId, month, year, spaceId, role);
            if (salary == null) return NotFound(new { message = "Salary structure not found." });

            var history = await _salaryService.GetPaymentHistoryAsync(empId, limit: 12, spaceId, role);
            var slips = await _salaryService.GetMyPayslipsAsync(empId, limit: 24, spaceId, role);
            var report = await _salaryService.GetProgressReportAsync(empId, spaceId, role);

            // Fetch dynamic attendance records to extract work impact stats
            var totalWorkingDays = DateTime.DaysInMonth(year, month); // fallback / simple count
            int presentDays = 0;
            int lateDays = 0;
            decimal lateDeduction = 0m;
            decimal absentDeduction = 0m;

            var lateItem = salary.Deductions.FirstOrDefault(d => d.DeductionType == "Late");
            if (lateItem != null)
            {
                lateDeduction = lateItem.Amount;
                var match = System.Text.RegularExpressions.Regex.Match(lateItem.Name, @"\d+");
                if (match.Success) int.TryParse(match.Value, out lateDays);
            }

            var absentItem = salary.Deductions.FirstOrDefault(d => d.DeductionType == "Absent");
            if (absentItem != null)
            {
                absentDeduction = absentItem.Amount;
                var match = System.Text.RegularExpressions.Regex.Match(absentItem.Name, @"\d+");
                if (match.Success)
                {
                    int.TryParse(match.Value, out var absCount);
                    presentDays = Math.Max(0, totalWorkingDays - absCount);
                }
            }
            else
            {
                presentDays = totalWorkingDays;
            }

            return Ok(new
            {
                SalaryStructure = salary,
                PaymentHistory = history,
                Payslips = slips,
                WorkImpact = new
                {
                    TotalWorkingDays = totalWorkingDays,
                    PresentDays = presentDays,
                    AbsentDays = totalWorkingDays - presentDays,
                    LateDays = lateDays,
                    LateDeduction = lateDeduction,
                    AbsentDeduction = absentDeduction
                }
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PayrollController] Error in GetFullPayrollDetails: {ex.Message}");
            return StatusCode(500, new { message = "An error occurred while fetching full payroll details." });
        }
    }

    // POST /api/payroll/process-month
    [HttpPost("process-month")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ProcessMonthPayroll([FromBody] ProcessPayrollRequest request)
    {
        try
        {
            var adminEmpId = GetEmpId();
            if (adminEmpId == 0) return Unauthorized();

            if (request.Month <= 0 || request.Month > 12 || request.Year <= 0)
            {
                return BadRequest(new { message = "Invalid month or year." });
            }

            var successCount = await _salaryService.ProcessMonthPayrollAsync(adminEmpId, request.Month, request.Year);
            return Ok(new { message = $"Successfully processed monthly payroll for {successCount} employees.", processedCount = successCount });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PayrollController] Error in ProcessMonthPayroll: {ex.Message}");
            return StatusCode(500, new { message = "Failed to process payroll for the month." });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  GET /api/payroll/salary-slip/{empId}?month=&year=
    //  Returns a structured salary slip with full breakdown
    // ──────────────────────────────────────────────────────────────────
    [HttpGet("salary-slip/{empId:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetSalarySlip(int empId, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        try
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            // Get employee info
            var empSql = @"SELECT u.empid, u.name, u.email, u.spaceid, s.spacename 
                           FROM t_users u LEFT JOIN t_spaces s ON u.spaceid = s.spaceid 
                           WHERE u.empid = @EmpId;";
            var emp = await Dapper.SqlMapper.QueryFirstOrDefaultAsync<dynamic>(_db, empSql, new { EmpId = empId });
            if (emp == null) return NotFound(new { message = "Employee not found." });

            // Get base salary
            var baseSalarySql = @"SELECT COALESCE(basic, 25000) FROM t_employeesalary WHERE empid = @EmpId;";
            var baseSalary = await Dapper.SqlMapper.ExecuteScalarAsync<decimal?>(_db, baseSalarySql, new { EmpId = empId }) ?? 25000m;

            // Get allowances
            var allowancesSql = @"SELECT name, type, value FROM t_allowances WHERE spaceid = @SpaceId ORDER BY allowanceid;";
            var allowances = (await Dapper.SqlMapper.QueryAsync<dynamic>(_db, allowancesSql, new { SpaceId = (int)emp.spaceid })).ToList();

            // Get deductions
            var deductionsSql = @"SELECT name, type, value FROM t_deductions WHERE spaceid = @SpaceId ORDER BY deductionid;";
            var deductionsRaw = (await Dapper.SqlMapper.QueryAsync<dynamic>(_db, deductionsSql, new { SpaceId = (int)emp.spaceid })).ToList();

            // Calculate allowance amounts
            var allowanceItems = allowances.Select(a => {
                decimal calcAmount = ((string)a.type)?.ToLower() == "percentage"
                    ? baseSalary * (decimal)a.value / 100m
                    : (decimal)a.value;
                return new SalaryLineItem
                {
                    Name = (string)(a.name ?? ""),
                    Type = (string)(a.type ?? "Fixed"),
                    ConfiguredValue = (decimal)a.value,
                    CalculatedAmount = Math.Round(calcAmount, 2)
                };
            }).ToList();

            // Calculate deduction amounts
            var deductionItems = deductionsRaw.Select(d => {
                decimal calcAmount = ((string)d.type)?.ToLower() == "percentage"
                    ? baseSalary * (decimal)d.value / 100m
                    : (decimal)d.value;
                return new SalaryLineItem
                {
                    Name = (string)(d.name ?? ""),
                    Type = (string)(d.type ?? "Fixed"),
                    ConfiguredValue = (decimal)d.value,
                    CalculatedAmount = Math.Round(calcAmount, 2)
                };
            }).ToList();

            decimal totalAllowances = allowanceItems.Sum(a => a.CalculatedAmount);
            decimal totalDeductions = deductionItems.Sum(d => d.CalculatedAmount);
            decimal grossSalary = baseSalary + totalAllowances;
            decimal netSalary = grossSalary - totalDeductions;

            // Get attendance for the month
            var attSql = @"SELECT COUNT(DISTINCT attendancedate) AS dayspresent, 
                           COALESCE(SUM(overtimehours), 0) AS overtimehours
                           FROM t_attendance 
                           WHERE empid = @EmpId 
                             AND EXTRACT(MONTH FROM attendancedate) = @Month 
                             AND EXTRACT(YEAR FROM attendancedate) = @Year 
                             AND clockin IS NOT NULL;";
            var att = await Dapper.SqlMapper.QueryFirstOrDefaultAsync<dynamic>(_db, attSql, new { EmpId = empId, Month = month, Year = year });

            // Get leaves
            var leavesSql = @"SELECT COUNT(*) FROM t_leaves 
                              WHERE empid = @EmpId 
                                AND EXTRACT(MONTH FROM leavedate) = @Month 
                                AND EXTRACT(YEAR FROM leavedate) = @Year 
                                AND status = 'Approved';";
            var leaveDays = await Dapper.SqlMapper.ExecuteScalarAsync<int>(_db, leavesSql, new { EmpId = empId, Month = month, Year = year });

            // Fetch holidays for the space in the month/year
            var holidaySql = @"SELECT DATE(holidaydate) AS hdate FROM t_holidays 
                               WHERE spaceid = @SpaceId 
                                 AND EXTRACT(MONTH FROM holidaydate) = @Month 
                                 AND EXTRACT(YEAR FROM holidaydate) = @Year;";
            var spaceIdVal = (int)emp.spaceid;
            var holidayDates = (await Dapper.SqlMapper.QueryAsync<DateTime>(_db, holidaySql, new { SpaceId = spaceIdVal, Month = month, Year = year })).Select(d => d.Date).ToHashSet();

            // Working days calculation (exclude Sundays and holidays)
            int daysInMonth = DateTime.DaysInMonth(year, month);
            int totalWorkingDays = 0;
            for (int d = 1; d <= daysInMonth; d++)
            {
                var dt = new DateTime(year, month, d);
                if (dt.DayOfWeek != DayOfWeek.Sunday && !holidayDates.Contains(dt.Date))
                    totalWorkingDays++;
            }

            var monthNames = new[] { "", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" };

            var slip = new SalarySlip
            {
                EmpId = empId,
                Name = (string)(emp.name ?? ""),
                Email = (string)(emp.email ?? ""),
                SpaceName = (string)(emp.spacename ?? ""),
                SpaceId = (int)emp.spaceid,
                Month = month,
                Year = year,
                MonthName = month >= 1 && month <= 12 ? monthNames[month] : "",
                BaseSalary = baseSalary,
                Allowances = allowanceItems,
                TotalAllowances = totalAllowances,
                GrossSalary = grossSalary,
                Deductions = deductionItems,
                TotalDeductions = totalDeductions,
                TotalWorkingDays = totalWorkingDays,
                DaysPresent = att != null ? (int)att.dayspresent : 0,
                LeaveDays = leaveDays,
                OvertimeHours = att != null ? (decimal)att.overtimehours : 0m,
                NetSalary = Math.Round(netSalary, 2),
            };

            return Ok(slip);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PayrollController] Error in GetSalarySlip: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "Failed to generate salary slip.", error = ex.Message });
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  GET /api/payroll/export-excel?spaceId=&month=&year=
    //  Downloads enhanced dual-sheet Excel (Monthly Report + Yearly Summary)
    // ──────────────────────────────────────────────────────────────────
    [HttpGet("export-excel")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ExportPayrollExcel([FromQuery] int spaceId, [FromQuery] int month, [FromQuery] int year)
    {
        try
        {
            if (spaceId <= 0 || month < 1 || month > 12 || year < 2020)
                return BadRequest(new { message = "Invalid spaceId, month, or year." });

            var bytes = await _excelService.ExportPayrollReportAsync(spaceId, month, year);
            var fileName = $"Payroll_Report_Space{spaceId}_{year}-{month:00}.xlsx";
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PayrollController] Error in ExportPayrollExcel: {ex.Message}");
            return StatusCode(500, new { message = "Failed to generate Excel report." });
        }
    }
}

public class ProcessPayrollRequest
{
    public int Month { get; set; }
    public int Year { get; set; }
}
