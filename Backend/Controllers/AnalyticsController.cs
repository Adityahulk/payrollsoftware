namespace Backend.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using Backend.Repositories;

[ApiController]
[Route("api")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsRepository _analyticsRepo;

    public AnalyticsController(IAnalyticsRepository analyticsRepo)
    {
        _analyticsRepo = analyticsRepo;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    [HttpGet("analytics/productivity")]
    public async Task<IActionResult> GetProductivity()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();
            var data = await _analyticsRepo.GetProductivityAsync(empId);
            return Ok(data);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[AnalyticsController] Error in GetProductivity: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving productivity analytics.", error = ex.Message });
        }
    }

    [HttpGet("payroll/impact")]
    public async Task<IActionResult> GetPayrollImpact()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();
            var data = await _analyticsRepo.GetPayrollImpactAsync(empId);
            return Ok(data);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[AnalyticsController] Error in GetPayrollImpact: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving payroll impact analytics.", error = ex.Message });
        }
    }

    [HttpGet("performance")]
    public async Task<IActionResult> GetPerformanceGrade()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();
            var data = await _analyticsRepo.GetPerformanceGradeAsync(empId);
            return Ok(data);
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[AnalyticsController] Error in GetPerformanceGrade: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An error occurred while retrieving performance grade.", error = ex.Message });
        }
    }
}
