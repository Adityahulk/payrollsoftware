namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using System;
using Backend.Services;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SalaryController : ControllerBase
{
    private readonly ISalaryService _salaryService;

    public SalaryController(ISalaryService salaryService)
    {
        _salaryService = salaryService;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private int GetSpaceId()
    {
        var role = GetRole();
        if (role == "Admin")
        {
            return GetEmpId();
        }
        var claim = User.FindFirst("SpaceId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee";

    // GET /api/Salary/me?month=5&year=2026
    [HttpGet("me")]
    public async Task<IActionResult> GetMySalary([FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        try
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var salary = await _salaryService.GetSalaryAsync(empId, month, year, spaceId, role);
            if (salary == null) return NotFound(new { message = "Salary record not found." });

            return Ok(salary);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (System.Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while retrieving salary breakdown.", error = ex.Message });
        }
    }

    // GET /api/Salary/{empId}?month=5&year=2026  (supervisor access)
    [HttpGet("{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetSalaryByEmpId(int empId, [FromQuery] int month = 0, [FromQuery] int year = 0)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var salary = await _salaryService.GetSalaryAsync(empId, month, year, spaceId, role);
            if (salary == null) return NotFound(new { message = "Salary record not found." });

            return Ok(salary);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (System.Exception ex)
        {
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
            var spaceId = GetSpaceId();
            var role = GetRole();
            if (empId == 0) return Unauthorized();

            var report = await _salaryService.GetProgressReportAsync(empId, spaceId, role);
            return Ok(report);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (System.Exception ex)
        {
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
            var spaceId = GetSpaceId();
            var role = GetRole();

            var report = await _salaryService.GetProgressReportAsync(empId, spaceId, role);
            return Ok(report);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (System.Exception ex)
        {
            return StatusCode(500, new { message = "An error occurred while retrieving employee progress report.", error = ex.Message });
        }
    }
}
