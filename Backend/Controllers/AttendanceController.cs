namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System.Linq;
using System;
using Backend.Models;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController : ControllerBase
{
    private readonly IAttendanceRepository _attendanceRepository;
    private readonly IUserRepository _userRepository;
    private readonly Backend.Services.INotificationService _notificationService;

    public AttendanceController(IAttendanceRepository attendanceRepository, IUserRepository userRepository, Backend.Services.INotificationService notificationService)
    {
        _attendanceRepository = attendanceRepository;
        _userRepository = userRepository;
        _notificationService = notificationService;
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMyAttendance()
    {
        var empIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                         ?? User.FindFirst("nameid")?.Value;

        int empId = 0;
        bool hasEmpId = int.TryParse(empIdClaim, out empId);
        if (!hasEmpId && !string.IsNullOrEmpty(empIdClaim))
        {
            var userByEmail = await _userRepository.GetUserByEmailAsync(empIdClaim);
            if (userByEmail != null)
            {
                empId = userByEmail.EmpId;
                hasEmpId = true;
            }
        }

        if (hasEmpId)
        {
            var attendance = await _attendanceRepository.GetAttendanceByUserIdAsync(empId);
            var dateOfJoining = await _attendanceRepository.GetDateOfJoiningAsync(empId);
            var workingDays = await _attendanceRepository.GetWorkingDaysByEmpIdAsync(empId);
            return Ok(new { attendance, dateOfJoining, workingDays });
        }

        return Unauthorized(new { message = "Invalid user session claims" });
    }

    [HttpPost("clock-in")]
    [Authorize]
    public async Task<IActionResult> ClockIn()
    {
        Console.WriteLine("Claims:");
        foreach (var claim in User.Claims)
        {
            Console.WriteLine($"{claim.Type} : {claim.Value}");
        }

        var empIdClaim = User.FindFirst("EmpId")?.Value;

        if (string.IsNullOrEmpty(empIdClaim))
        {
            Console.WriteLine("EmpId missing in token");
            return Unauthorized(new { message = "Invalid token or missing EmpId" });
        }

        if (!int.TryParse(empIdClaim, out int empId))
            return BadRequest(new { message = "Invalid EmpId format in token" });

        var result = await _attendanceRepository.ClockInAsync(empId);

        if (!result)
            return BadRequest(new { message = "Already clocked in today" });

        try
        {
            var user = await _userRepository.GetUserByIdAsync(empId);
            if (user != null)
            {
                await _notificationService.NotifyClockInAsync(empId, user.Email, user.SpaceId ?? 0, DateTime.UtcNow);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Notification Trigger Error] Clock-in: {ex.Message}");
        }

        return Ok(new { message = "Clock-in successful" });
    }

    [HttpPost("clock-out")]
    [Authorize]
    public async Task<IActionResult> ClockOut()
    {
        var empIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                         ?? User.FindFirst("nameid")?.Value;

        int empId = 0;
        bool hasEmpId = int.TryParse(empIdClaim, out empId);
        if (!hasEmpId && !string.IsNullOrEmpty(empIdClaim))
        {
            var userByEmail = await _userRepository.GetUserByEmailAsync(empIdClaim);
            if (userByEmail != null)
            {
                empId = userByEmail.EmpId;
                hasEmpId = true;
            }
        }

        if (!hasEmpId) return Unauthorized(new { message = "Invalid user session claims" });

        var records = await _attendanceRepository.GetAttendanceByUserIdAsync(empId);
        var activeRecord = records.FirstOrDefault(r => r.ClockIn.HasValue && !r.ClockOut.HasValue);
        
        if (activeRecord == null)
        {
            return BadRequest(new { message = "You have not clocked in yet or you already clocked out today!" });
        }

        var clockOutTime = DateTime.Now;
        var clockInTime = activeRecord.ClockIn.Value;
        decimal totalHours = (decimal)(clockOutTime - clockInTime).TotalHours;

        var times = await _attendanceRepository.GetSpaceWorkTimesAsync(empId);
        int earlyExitMinutes = 0;

        // Check if today is a working day - suppress early exit penalty on off-days
        var workingDays = await _attendanceRepository.GetWorkingDaysByEmpIdAsync(empId);
        string todayName = Backend.Models.Space.DayOfWeekToShortName(DateTime.Now.DayOfWeek);
        bool isWorkingDay = workingDays.Contains(todayName, StringComparer.OrdinalIgnoreCase);
        
        if (isWorkingDay && times.EndTime.HasValue)
        {
            var standardExitTime = clockOutTime.Date.Add(times.EndTime.Value);
            if (clockOutTime < standardExitTime)
            {
                earlyExitMinutes = (int)(standardExitTime - clockOutTime).TotalMinutes;
            }
        }

        if (isWorkingDay && times.WorkingHours.HasValue)
        {
            int shortfall = (int)((times.WorkingHours.Value - (double)totalHours) * 60);
            if (shortfall > earlyExitMinutes)
            {
                earlyExitMinutes = shortfall;
            }
        }

        var success = await _attendanceRepository.ClockOutAsync(activeRecord.AttendanceId, clockOutTime, totalHours, earlyExitMinutes);
        if (!success) return StatusCode(500, new { message = "Failed to update clock-out records in database." });

        return Ok(new { Message = "Clocked out successfully!", TotalHours = totalHours, EarlyExitMinutes = earlyExitMinutes, ClockOut = clockOutTime });
    }

    [HttpGet("user/{empid}")]
    public async Task<IActionResult> GetAttendanceByUserId(int empid)
    {
        var attendance = await _attendanceRepository.GetAttendanceByUserIdAsync(empid);
        var workingDays = await _attendanceRepository.GetWorkingDaysByEmpIdAsync(empid);
        return Ok(new { attendance, workingDays });
    }

    [HttpGet]
    public async Task<IActionResult> GetAllAttendance()
    {
        var attendance = await _attendanceRepository.GetAllAttendanceAsync();
        return Ok(attendance);
    }

    [HttpPost("break-start")]
    [Authorize]
    public async Task<IActionResult> StartBreak()
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value;
        if (string.IsNullOrEmpty(empIdClaim))
            return Unauthorized(new { message = "Invalid token or missing EmpId" });

        if (!int.TryParse(empIdClaim, out int empId))
            return BadRequest(new { message = "Invalid EmpId format" });

        var result = await _attendanceRepository.StartBreakAsync(empId);

        if (!result)
            return BadRequest(new { message = "Break already started or 60-minute daily limit reached" });

        return Ok(new { message = "Break started successfully" });
    }

    [HttpPost("break-end")]
    [Authorize]
    public async Task<IActionResult> EndBreak()
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value;
        if (string.IsNullOrEmpty(empIdClaim))
            return Unauthorized(new { message = "Invalid token or missing EmpId" });

        if (!int.TryParse(empIdClaim, out int empId))
            return BadRequest(new { message = "Invalid EmpId format" });

        try
        {
            var result = await _attendanceRepository.EndBreakAsync(empId);

            if (!result)
                return BadRequest(new { message = "No active break found to end" });

            return Ok(new { message = "Break ended successfully" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("test-clear")]
    [Authorize]
    public async Task<IActionResult> TestClearToday()
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value;
        if (int.TryParse(empIdClaim, out int empId))
        {
            await _attendanceRepository.TestClearTodayAsync(empId);
        }
        return Ok(new { message = "Today's attendance cleared." });
    }

    [HttpGet("trends")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTrends([FromQuery] int? empId)
    {
        int targetEmpId = empId ?? 1;
        try
        {
            var data = await _attendanceRepository.GetTrendsAsync(targetEmpId);
            return Ok(data);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, stackTrace = ex.StackTrace, inner = ex.InnerException?.Message });
        }
    }

    [HttpGet("test-users")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTestUsers()
    {
        try
        {
            var users = await _userRepository.GetAllUsersAsync();
            return Ok(users.Select(u => new { u.EmpId, u.Email, u.Role }));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.ToString());
        }
    }
}

