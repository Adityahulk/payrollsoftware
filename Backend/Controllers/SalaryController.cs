namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalaryController : ControllerBase
{
    private readonly ISalaryRepository _salaryRepo;

    public SalaryController(ISalaryRepository salaryRepo)
    {
        _salaryRepo = salaryRepo;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    // GET /api/Salary/me?month=5&year=2026
    [HttpGet("me")]
    public async Task<IActionResult> GetMySalary([FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var salary = await _salaryRepo.GetSalaryAsync(empId, month, year);
            if (salary == null) return NotFound(new { message = "Salary record not found." });

            return Ok(salary);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[SalaryController] Error in GetMySalary: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving salary breakdown.", error = ex.Message });
        }
    }

    // GET /api/Salary/{empId}?month=5&year=2026  (admin access)
    [HttpGet("{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetSalaryByEmpId(int empId, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        try
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var salary = await _salaryRepo.GetSalaryAsync(empId, month, year);
            if (salary == null) return NotFound(new { message = "Salary record not found." });

            return Ok(salary);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[SalaryController] Error in GetSalaryByEmpId: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving employee salary.", error = ex.Message });
        }
    }

    // GET /api/Salary/progress
    [HttpGet("progress")]
    public async Task<IActionResult> GetMyProgress()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();
            var report = await _salaryRepo.GetProgressReportAsync(empId);
            return Ok(report);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[SalaryController] Error in GetMyProgress: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving progress report.", error = ex.Message });
        }
    }

    // GET /api/Salary/progress/{empId}
    [HttpGet("progress/{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetProgressByEmpId(int empId)
    {
        try
        {
            var report = await _salaryRepo.GetProgressReportAsync(empId);
            return Ok(report);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[SalaryController] Error in GetProgressByEmpId: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving employee progress report.", error = ex.Message });
        }
    }
}
