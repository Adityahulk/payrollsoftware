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
}
