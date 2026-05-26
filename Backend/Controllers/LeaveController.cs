namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LeaveController : ControllerBase
{
    private readonly ILeaveRepository _leaveRepo;
    private readonly IUserRepository _userRepository;
    private readonly Backend.Services.INotificationService _notificationService;

    public LeaveController(ILeaveRepository leaveRepo, IUserRepository userRepository, Backend.Services.INotificationService notificationService)
    {
        _leaveRepo = leaveRepo;
        _userRepository = userRepository;
        _notificationService = notificationService;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────
    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole()
    {
        return User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
            ?? User.FindFirst("role")?.Value
            ?? "Employee";
    }

    private int? GetSpaceId()
    {
        var raw = User.FindFirst("SpaceId")?.Value ?? User.FindFirst("spaceid")?.Value;
        return int.TryParse(raw, out var id) ? id : null;
    }

    // ─── POST /api/Leave — Apply Leave ────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> ApplyLeave([FromBody] LeaveRequest req)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            if (!DateTime.TryParse(req.LeaveDate, out var leaveDate))
                return BadRequest(new { message = "Invalid date format. Use YYYY-MM-DD." });

            var validTypes = new[] { "Normal", "Emergency", "College" };
            if (!Array.Exists(validTypes, t => t == req.LeaveType))
                return BadRequest(new { message = "Invalid leave type. Must be Normal, Emergency, or College." });

            var leave = new Leave
            {
                EmpId     = empId,
                LeaveDate = leaveDate,
                Reason    = req.Reason,
                LeaveType = req.LeaveType ?? "Normal",
                HalfDay   = req.HalfDay
            };

            var (success, error) = await _leaveRepo.ApplyLeaveAsync(leave);
            if (!success)
            {
                Console.WriteLine($"[LeaveController.ApplyLeave] Rejected: {error}");
                return BadRequest(new { message = error });
            }

            try
            {
                var user = await _userRepository.GetUserByIdAsync(empId);
                if (user != null)
                {
                    await _notificationService.NotifyLeaveAppliedAsync(empId, user.Email, user.SpaceId ?? 0, leaveDate, req.Reason ?? "");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Notification Trigger Error] Apply Leave: {ex.Message}");
            }

            return Ok(new { message = "Leave applied successfully." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveController.ApplyLeave] EXCEPTION: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { message = "An unexpected error occurred." });
        }
    }

    // ─── GET /api/Leave/me — My Leave History ─────────────────────────────────
    [HttpGet("me")]
    public async Task<IActionResult> GetMyLeaves()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var leaves = await _leaveRepo.GetLeavesByEmpIdAsync(empId);
            return Ok(leaves);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveController.GetMyLeaves] {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch leave history." });
        }
    }

    // ─── GET /api/Leave/balance — My Leave Balance ────────────────────────────
    [HttpGet("balance")]
    public async Task<IActionResult> GetLeaveBalance()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var balance = await _leaveRepo.GetLeaveBalanceAsync(empId);
            return Ok(balance);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveController.GetLeaveBalance] {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch leave balance." });
        }
    }

    // ─── GET /api/Leave — All Leaves (role-filtered) ──────────────────────────
    [HttpGet]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetAllLeaves()
    {
        try
        {
            var role    = GetRole();
            var spaceId = GetSpaceId();
            var leaves  = await _leaveRepo.GetAllLeavesAsync(spaceId, role);
            return Ok(leaves);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveController.GetAllLeaves] {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch leave requests." });
        }
    }

    // ─── PATCH /api/Leave/{id}/status — Approve / Reject ─────────────────────
    [HttpPatch("{leaveId}/status")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> UpdateStatus(int leaveId, [FromBody] UpdateLeaveStatusRequest req)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var validStatuses = new[] { "Approved", "Rejected", "Pending" };
            if (!Array.Exists(validStatuses, s => s == req.Status))
                return BadRequest(new { message = "Invalid status. Must be Approved, Rejected, or Pending." });

            var success = await _leaveRepo.UpdateLeaveStatusAsync(leaveId, req.Status, empId);
            if (!success) return NotFound(new { message = "Leave record not found." });

            return Ok(new { message = $"Leave {req.Status.ToLower()} successfully." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveController.UpdateStatus] {ex.Message}");
            return StatusCode(500, new { message = "Failed to update leave status." });
        }
    }

    // ─── GET /api/Leave/config/{spaceId} — Space Leave Policy ────────────────
    [HttpGet("config/{spaceId}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> GetLeaveConfig(int spaceId)
    {
        try
        {
            var config = await _leaveRepo.GetSpaceLeaveConfigAsync(spaceId);
            return Ok(config);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveController.GetLeaveConfig] {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch leave configuration." });
        }
    }

    // ─── PUT /api/Leave/config/{spaceId} — Update Space Leave Policy ──────────
    [HttpPut("config/{spaceId}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateLeaveConfig(int spaceId, [FromBody] SpaceLeaveConfig config)
    {
        try
        {
            config.SpaceId = spaceId;
            if (config.EmergencyLeavesPerMonth < 0 || config.CollegeLeavesPerMonth < 0)
                return BadRequest(new { message = "Leave limits cannot be negative." });

            var success = await _leaveRepo.UpsertSpaceLeaveConfigAsync(config);
            if (!success) return BadRequest(new { message = "Failed to save leave configuration." });

            return Ok(new { message = "Leave policy updated successfully." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveController.UpdateLeaveConfig] {ex.Message}");
            return StatusCode(500, new { message = "Failed to update leave configuration." });
        }
    }
}
