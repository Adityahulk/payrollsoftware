namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using System;
using Backend.Models;
using Backend.Services;

[ApiController]
[Route("api/[controller]")]
[Route("api/worklogs")]
[Authorize]
public class WorklogController : ControllerBase
{
    private readonly IWorklogService _worklogService;

    public WorklogController(IWorklogService worklogService)
    {
        _worklogService = worklogService;
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

    private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    // POST /api/worklogs
    [HttpPost]
    public async Task<IActionResult> CreateWorklog([FromBody] WorkLogRequest request)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            if (request == null) return BadRequest(new { message = "Worklog details are required." });

            var logId = await _worklogService.CreateWorklogAsync(request, empId);
            return Ok(new { logId, message = "Work log saved." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to save work log.", details = ex.Message });
        }
    }

    // GET /api/worklogs (current user)
    [HttpGet]
    public async Task<IActionResult> GetMyWorklogs()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var spaceId = GetSpaceId();
            var role = GetRole();

            var logs = await _worklogService.GetWorklogsByEmpIdAsync(empId, spaceId, role);
            return Ok(logs);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch work logs.", details = ex.Message });
        }
    }

    // GET /api/worklogs/me (chart data)
    [HttpGet("me")]
    public async Task<IActionResult> GetMyWorklogsChart([FromQuery] string range)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var spaceId = GetSpaceId();
            var role = GetRole();

            var chartData = await _worklogService.GetWorklogsChartAsync(empId, range, spaceId, role);
            return Ok(chartData);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch work log chart data.", details = ex.Message });
        }
    }

    // GET /api/worklogs/{empId} (admin/TL access)
    [HttpGet("{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetWorklogsByEmpId(int empId)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var logs = await _worklogService.GetWorklogsByEmpIdAsync(empId, spaceId, role);
            return Ok(logs);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch employee work logs.", details = ex.Message });
        }
    }

    // GET /api/worklogs/tasks (current user task progress)
    [HttpGet("tasks")]
    public async Task<IActionResult> GetMyTaskProgress()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var spaceId = GetSpaceId();
            var role = GetRole();

            var tasks = await _worklogService.GetTaskProgressByEmpIdAsync(empId, spaceId, role);
            return Ok(new {
                success = true,
                data = tasks
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch task progress.", details = ex.Message });
        }
    }

    // GET /api/worklogs/tasks/{empId} (admin/TL access)
    [HttpGet("tasks/{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetTaskProgressByEmpId(int empId)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var tasks = await _worklogService.GetTaskProgressByEmpIdAsync(empId, spaceId, role);
            return Ok(tasks);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch task progress.", details = ex.Message });
        }
    }

    // GET /api/worklogs/me/activity
    [HttpGet("me/activity")]
    public async Task<IActionResult> GetMyDailyActivity([FromQuery] string range)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var spaceId = GetSpaceId();
            var role = GetRole();

            var activity = await _worklogService.GetEmployeeDailyActivityAsync(empId, range, spaceId, role);
            return Ok(activity);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch daily activity logs.", details = ex.Message });
        }
    }

    // GET /api/worklogs/activity/{empId} (admin/Manager/TL access)
    [HttpGet("activity/{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetDailyActivityByEmpId(int empId, [FromQuery] string range)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var activity = await _worklogService.GetEmployeeDailyActivityAsync(empId, range, spaceId, role);
            return Ok(activity);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch employee daily activity logs.", details = ex.Message });
        }
    }
}
