namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using Backend.Repositories;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Admin")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardRepository _dashboardRepository;

    public DashboardController(IDashboardRepository dashboardRepository)
    {
        _dashboardRepository = dashboardRepository;
    }

    [HttpGet("recent-worklogs")]
    public async Task<IActionResult> GetRecentWorklogs([FromQuery] int days = 7)
    {
        try
        {
            var claim = User.FindFirst("empId") ?? User.FindFirst("EmpId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (claim == null)
                return Unauthorized(new { message = "Unauthorized admin session." });

            int adminId = int.Parse(claim.Value);
            var worklogs = await _dashboardRepository.GetRecentWorklogsAsync(adminId, days);
            return Ok(worklogs);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DashboardController.GetRecentWorklogs] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch recent worklogs." });
        }
    }

    [HttpGet("recent-employees")]
    public async Task<IActionResult> GetRecentEmployees([FromQuery] int days = 30)
    {
        try
        {
            var claim = User.FindFirst("empId") ?? User.FindFirst("EmpId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (claim == null)
                return Unauthorized(new { message = "Unauthorized admin session." });

            int adminId = int.Parse(claim.Value);
            var employees = await _dashboardRepository.GetRecentEmployeesAsync(adminId, days);
            return Ok(employees);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DashboardController.GetRecentEmployees] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch recent employees." });
        }
    }

    // New: single optimized call replacing 5+ frontend API calls
    [HttpGet("admin-summary")]
    public async Task<IActionResult> GetAdminSummary()
    {
        try
        {
            var claim = User.FindFirst("empId") ?? User.FindFirst("EmpId") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (claim == null)
                return Unauthorized(new { message = "Unauthorized admin session." });

            int adminId = int.Parse(claim.Value);
            var summary = await _dashboardRepository.GetAdminSummaryAsync(adminId);
            return Ok(summary);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DashboardController.GetAdminSummary] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch admin summary." });
        }
    }
}
