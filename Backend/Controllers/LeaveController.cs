namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Services;
using System.Security.Claims;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LeaveController : ControllerBase
{
    private readonly ILeaveService _leaveService;

    public LeaveController(ILeaveService leaveService)
    {
        _leaveService = leaveService;
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

    [HttpPost]
    public async Task<IActionResult> ApplyLeave([FromBody] LeaveRequest req)
    {
        var empId = GetEmpId();
        var spaceId = GetSpaceId();
        if (empId == 0) return Unauthorized();

        var (success, error) = await _leaveService.ApplyLeaveAsync(req, empId, spaceId);
        if (!success)
        {
            return BadRequest(new { message = error });
        }
        return Ok(new { message = "Leave applied successfully." });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyLeaves()
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();

        var leaves = await _leaveService.GetMyLeavesAsync(empId);
        return Ok(leaves);
    }

    [HttpGet("balance")]
    public async Task<IActionResult> GetLeaveBalance()
    {
        var empId = GetEmpId();
        var spaceId = GetSpaceId();
        var role = GetRole();
        if (empId == 0) return Unauthorized();

        try
        {
            var balance = await _leaveService.GetLeaveBalanceAsync(empId, empId, spaceId, role);
            return Ok(balance);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    [HttpGet("balance/{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetEmployeeLeaveBalance(int empId)
    {
        var callerEmpId = GetEmpId();
        var spaceId = GetSpaceId();
        var role = GetRole();

        try
        {
            var balance = await _leaveService.GetLeaveBalanceAsync(empId, callerEmpId, spaceId, role);
            return Ok(balance);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetAllLeaves()
    {
        var spaceId = GetSpaceId();
        var role = GetRole();

        try
        {
            var leaves = await _leaveService.GetAllLeavesAsync(spaceId, role);
            return Ok(leaves);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    [HttpPatch("{leaveId:int}/status")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> UpdateStatus(int leaveId, [FromBody] UpdateLeaveStatusRequest req)
    {
        var empId = GetEmpId();
        var spaceId = GetSpaceId();
        var role = GetRole();
        if (empId == 0) return Unauthorized();

        try
        {
            var success = await _leaveService.UpdateLeaveStatusAsync(leaveId, req.Status, empId, spaceId, role);
            if (!success) return NotFound(new { message = "Leave record not found." });

            return Ok(new { message = $"Leave {req.Status.ToLower()} successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    [HttpGet("config/{spaceId:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetLeaveConfig(int spaceId)
    {
        var callerSpaceId = GetSpaceId();
        var role = GetRole();

        try
        {
            var config = await _leaveService.GetSpaceLeaveConfigAsync(spaceId, callerSpaceId, role);
            return Ok(config);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    [HttpPut("config/{spaceId:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateLeaveConfig(int spaceId, [FromBody] SpaceLeaveConfig config)
    {
        var callerSpaceId = GetSpaceId();
        var role = GetRole();

        try
        {
            var success = await _leaveService.UpdateLeaveConfigAsync(spaceId, config, callerSpaceId, role);
            if (!success) return BadRequest(new { message = "Failed to save leave configuration." });

            return Ok(new { message = "Leave policy updated successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
