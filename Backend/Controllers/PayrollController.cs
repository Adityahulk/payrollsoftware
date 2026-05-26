namespace Backend.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PayrollController : ControllerBase
{
    private readonly ISalaryRepository _salaryRepo;

    public PayrollController(ISalaryRepository salaryRepo)
    {
        _salaryRepo = salaryRepo;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    // GET /api/payroll/history — real payment records from t_payrollpayments
    [HttpGet("history")]
    public async Task<IActionResult> GetPaymentHistory([FromQuery] int limit = 12)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            var payments = await _salaryRepo.GetPaymentHistoryAsync(empId, limit);
            return Ok(payments);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[PayrollController] Error in GetPaymentHistory: {ex.Message}\n{ex.StackTrace}");
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

            var summary = await _salaryRepo.GetCtcSummaryAsync(empId, year);
            return Ok(summary);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[PayrollController] Error in GetCtcSummary: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving CTC summary.", error = ex.Message });
        }
    }

    // GET /api/payroll/myslips — employee's own payslips with admin-configured breakdown from t_payslips
    [HttpGet("myslips")]
    public async Task<IActionResult> GetMyPayslips([FromQuery] int limit = 24)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            var slips = await _salaryRepo.GetMyPayslipsAsync(empId, limit);
            return Ok(slips);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[PayrollController] Error in GetMyPayslips: {ex.Message}\n{ex.StackTrace}");
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

            var salary = await _salaryRepo.GetSalaryAsync(empId, month, year);
            if (salary == null) return NotFound(new { message = "Salary structure not found." });

            var history = await _salaryRepo.GetPaymentHistoryAsync(empId, limit: 12);
            var slips = await _salaryRepo.GetMyPayslipsAsync(empId, limit: 24);
            var report = await _salaryRepo.GetProgressReportAsync(empId);

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
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[PayrollController] Error in GetFullPayrollDetails: {ex.Message}");
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

            var users = await _salaryRepo.GetCompanyUsersForPayrollAsync(adminEmpId);
            int successCount = 0;

            foreach (var user in users.Where(u => u.Role != "Admin" && u.Status == "Active"))
            {
                var salaryResponse = await _salaryRepo.GetSalaryAsync(user.EmpId, request.Month, request.Year);
                if (salaryResponse == null) continue;

                bool alreadyPaid = await _salaryRepo.CheckIfAlreadyPaidAsync(user.EmpId, request.Month, request.Year);
                if (alreadyPaid) continue;

                var finalAmountToPay = salaryResponse.Net;
                var basicVal = salaryResponse.Basic;

                var allowancesList = salaryResponse.Allowances.Select(a => new { name = a.Name, type = a.Type, value = a.Value, amount = a.Amount }).ToList();
                var deductionsList = salaryResponse.Deductions.Where(d => d.DeductionType == "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount }).ToList();
                var penaltiesList = salaryResponse.Deductions.Where(d => d.DeductionType != "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount, deductionType = d.DeductionType }).ToList();

                var breakdownObj = new
                {
                    basic = basicVal,
                    hra = salaryResponse.Hra,
                    da = salaryResponse.Da,
                    allowances = allowancesList,
                    deductions = deductionsList,
                    penalties = penaltiesList,
                    finalAmount = finalAmountToPay
                };

                string breakdownJson = System.Text.Json.JsonSerializer.Serialize(breakdownObj);

                var paymentId = await _salaryRepo.CreatePayrollPaymentDirectAsync(
                    user.EmpId,
                    user.SpaceId ?? 0,
                    basicVal + salaryResponse.Hra + salaryResponse.Da,
                    salaryResponse.Deductions.Sum(d => d.Amount),
                    finalAmountToPay,
                    salaryResponse.Allowances.Sum(a => a.Amount),
                    "Direct Transfer",
                    $"TXN_{request.Year}_{request.Month}_{user.EmpId}"
                );

                if (paymentId > 0)
                {
                    await _salaryRepo.CreatePayslipDirectAsync(
                        user.EmpId,
                        user.SpaceId ?? 0,
                        basicVal + salaryResponse.Hra + salaryResponse.Da,
                        salaryResponse.Deductions.Sum(d => d.Amount),
                        finalAmountToPay,
                        paymentId,
                        basicVal,
                        salaryResponse.Allowances.Sum(a => a.Amount),
                        breakdownJson,
                        "Direct Transfer",
                        $"TXN_{request.Year}_{request.Month}_{user.EmpId}"
                    );
                    successCount++;
                }
            }

            return Ok(new { message = $"Successfully processed monthly payroll for {successCount} employees.", processedCount = successCount });
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[PayrollController] Error in ProcessMonthPayroll: {ex.Message}");
            return StatusCode(500, new { message = "Failed to process payroll for the month." });
        }
    }
}

public class ProcessPayrollRequest
{
    public int Month { get; set; }
    public int Year { get; set; }
}
