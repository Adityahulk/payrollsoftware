namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System.Linq;
using System;
using Backend.Models;
using Backend.Services;
using Backend.Repositories;
using System.Security.Claims;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ISalaryService _salaryService;
    private readonly ILeaveService _leaveService;
    private readonly IWorklogService _worklogService;
    private readonly IAttendanceService _attendanceService;
    private readonly IProfileRepository _profileRepo;

    public UserController(
        IUserService userService,
        ISalaryService salaryService,
        ILeaveService leaveService,
        IWorklogService worklogService,
        IAttendanceService attendanceService,
        IProfileRepository profileRepo)
    {
        _userService = userService;
        _salaryService = salaryService;
        _leaveService = leaveService;
        _worklogService = worklogService;
        _attendanceService = attendanceService;
        _profileRepo = profileRepo;
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

    // GET /api/User — Admin ONLY: full company user listing
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllUsers()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0)
                return Unauthorized(new { message = "Unable to resolve employee identity from token." });

            var spaceId = GetSpaceId();
            var role = GetRole();

            var users = await _userService.GetUsersByCompanyAsync(empId, spaceId, role);
            return Ok(users);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetAllUsers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch users." });
        }
    }

    // GET /api/User/company — All authenticated roles: read-only company employee directory
    [HttpGet("company")]
    [Authorize(Roles = "Admin,Manager,TeamLead,Employee")]
    public async Task<IActionResult> GetCompanyUsers()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0)
                return Unauthorized(new { message = "Unable to resolve employee identity from token." });

            var spaceId = GetSpaceId();
            var role = GetRole();

            var users = await _userService.GetUsersByCompanyAsync(empId, spaceId, role);
            return Ok(users);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetCompanyUsers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch company users." });
        }
    }

    // GET /api/User/team — TeamLead/Manager: all employees under same Admin (via space chain)
    [HttpGet("team")]
    [Authorize(Roles = "Admin,TeamLead,Manager")]
    public async Task<IActionResult> GetTeamMembers()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0)
                return Unauthorized(new { message = "Unable to resolve employee identity from token." });

            var spaceId = GetSpaceId();
            var role = GetRole();

            var users = await _userService.GetUsersByCompanyAsync(empId, spaceId, role);
            return Ok(users);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetTeamMembers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch team members." });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var user = await _userService.GetUserByIdAsync(id, spaceId, role);
            if (user == null) return NotFound(new { message = "User not found." });
            return Ok(user);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetUserById] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch user." });
        }
    }

    [HttpGet("search")]
    [Authorize(Roles = "Admin,TeamLead,Manager")]
    public async Task<IActionResult> SearchUsers([FromQuery] string query)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var spaceId = GetSpaceId();
            var role = GetRole();

            var filtered = await _userService.SearchUsersAsync(query, empId, spaceId, role);
            return Ok(filtered);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.SearchUsers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Search failed." });
        }
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUser([FromBody] User user)
    {
        try
        {
            if (user == null)
                return BadRequest(new { message = "User data is required." });

            var spaceId = GetSpaceId();
            var role = GetRole();

            user.DateOfJoining = DateTime.Today;
            user.Gender ??= "Unknown";
            user.Status ??= "Active";
            user.Role ??= "Employee";
            user.Email ??= "";
            if (string.IsNullOrEmpty(user.Name))
            {
                user.Name = user.Email.Contains("@") ? user.Email.Split('@')[0] : "New User";
            }

            // Secure Hashing for Manually Added Employees
            string plainPassword = !string.IsNullOrEmpty(user.Password) ? user.Password : "DefaultPassword123";
            if (plainPassword.Length < 6)
            {
                return BadRequest(new { message = "Password must be at least 6 characters long." });
            }
            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            user.PasswordHash = hasher.HashPassword(user, plainPassword);

            var userId = await _userService.CreateUserAsync(user, spaceId, role);
            return CreatedAtAction(nameof(GetUserById), new { id = userId }, user);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.CreateUser] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to create user." });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] User user)
    {
        try
        {
            var callerEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            user.EmpId = id;
            var result = await _userService.UpdateUserAsync(user, callerEmpId, spaceId, role);
            if (!result) return NotFound(new { message = "User not found." });
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.UpdateUser] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to update user." });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var result = await _userService.DeleteUserAsync(id, spaceId, role);
            if (!result) return NotFound(new { message = "User not found." });
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.DeleteUser] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to delete user." });
        }
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateUserStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        try
        {
            var callerEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            var result = await _userService.UpdateUserStatusAsync(id, request.Status, request.Reason, callerEmpId, spaceId, role);
            if (!result) return BadRequest(new { message = "Failed to update status." });

            return Ok(new { message = "Status updated successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.UpdateUserStatus] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to update status." });
        }
    }

    [HttpPost("{id}/warnings")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> AddWarning(int id, [FromBody] EmployeeWarning warning)
    {
        try
        {
            var callerEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            warning.EmpId = id;
            var warningId = await _userService.AddWarningAsync(warning, callerEmpId, spaceId, role);
            return Ok(new { WarningId = warningId });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.AddWarning] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to issue warning." });
        }
    }

    [HttpGet("{id}/warnings")]
    public async Task<IActionResult> GetWarnings(int id)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var warnings = await _userService.GetWarningsByUserIdAsync(id, spaceId, role);
            return Ok(warnings);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetWarnings] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch warnings." });
        }
    }

    // GET /api/User/space — Enforce space-level boundary for Managers/TLs
    [HttpGet("space")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetUsersBySpace()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var spaceId = GetSpaceId();
            var role = GetRole();

            if (role == "Admin")
            {
                var users = await _userService.GetUsersByCompanyAsync(empId, spaceId, role);
                return Ok(users);
            }
            else
            {
                var users = await _userService.GetUsersBySpaceIdAsync(spaceId, spaceId, role);
                // Exclude Admin from supervisor view
                var filtered = users.Where(u => (u.Role ?? "").ToLower() != "admin");
                return Ok(filtered);
            }
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetUsersBySpace] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch space users." });
        }
    }

    // PUT /api/User/toggle-status/{id}
    [HttpPut("toggle-status/{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ToggleUserStatus(int id)
    {
        try
        {
            var callerEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            var user = await _userService.GetUserByIdAsync(id, spaceId, role);
            if (user == null) return NotFound(new { message = "User not found." });

            var newStatus = (user.Status ?? "Active").Equals("Active", StringComparison.OrdinalIgnoreCase) 
                ? "Inactive" 
                : "Active";

            var result = await _userService.UpdateUserStatusAsync(id, newStatus, "Status toggled via user management control panel", callerEmpId, spaceId, role);
            if (!result) return BadRequest(new { message = "Failed to update status." });

            return Ok(new { message = $"User status successfully toggled to {newStatus}.", status = newStatus });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.ToggleUserStatus] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to toggle status." });
        }
    }

    // GET /api/User/{id}/full-profile
    [HttpGet("{id:int}/full-profile")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetUserFullProfile(int id)
    {
        try
        {
            var callerEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            var user = await _userService.GetUserByIdAsync(id, spaceId, role);
            if (user == null) return NotFound(new { message = "User not found." });

            int month = DateTime.UtcNow.Month;
            int year = DateTime.UtcNow.Year;

            // Fetch dynamic Leave Balance
            var leaveBalance = await _leaveService.GetLeaveBalanceAsync(id, callerEmpId, spaceId, role);

            // Fetch dynamic total worklog hours
            decimal totalHoursWorkedThisMonth = 0m;
            try
            {
                var worklogs = await _worklogService.GetWorklogsByEmpIdAsync(id, spaceId, role);
                if (worklogs != null)
                {
                    totalHoursWorkedThisMonth = worklogs
                        .Where(w => w.WorkDate.Month == month && w.WorkDate.Year == year)
                        .Sum(w => w.HoursWorked);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FullProfile] Worklogs query warning: {ex.Message}");
            }

            // Fetch dynamic salary preview
            var salaryPreview = await _salaryService.GetSalaryAsync(id, month, year, spaceId, role);

            // Fetch attendance summary stats this month
            int presentCount = 0;
            int lateCount = 0;
            int earlyExitCount = 0;
            int absentCount = 0;

            if (salaryPreview != null)
            {
                var attendanceRecords = await _attendanceService.GetAttendanceByUserIdAsync(id, spaceId, role);
                var thisMonthRecords = attendanceRecords
                    .Where(r => r.AttendanceDate.HasValue && r.AttendanceDate.Value.Month == month && r.AttendanceDate.Value.Year == year)
                    .ToList();

                presentCount = thisMonthRecords.Count;
                lateCount = thisMonthRecords.Count(r => (r.LateMinutes ?? 0) > 5);
                earlyExitCount = thisMonthRecords.Count(r => (r.EarlyExitMinutes ?? 0) > 0);

                var absentItem = salaryPreview.Deductions.FirstOrDefault(d => d.DeductionType == "Absent");
                if (absentItem != null)
                {
                    var match = System.Text.RegularExpressions.Regex.Match(absentItem.Name, @"\d+");
                    if (match.Success)
                    {
                        int.TryParse(match.Value, out absentCount);
                    }
                }
            }

            // Fetch bank details + documents
            IEnumerable<Backend.Models.DocumentRecord> documents = Enumerable.Empty<Backend.Models.DocumentRecord>();
            try 
            { 
                documents = await _profileRepo.GetDocumentsByEmpIdAsync(id); 
            }
            catch (Exception ex) 
            { 
                Console.WriteLine($"[FullProfile] Documents warning: {ex.Message}"); 
            }

            return Ok(new
            {
                User = new
                {
                    user.EmpId,
                    user.Name,
                    user.Email,
                    user.Role,
                    user.SpaceId,
                    user.Gender,
                    user.Status,
                    user.Phone,
                    user.Address,
                    user.DateOfJoining,
                    user.BackupEmail,
                    ProfilePhotoUrl = $"/profile-photo/{user.EmpId}.jpg"
                },
                BankDetails = new
                {
                    user.AccountNumber,
                    user.BankName,
                    user.AccountHolderName,
                    user.IfscCode,
                    user.UpiId
                },
                AttendanceSummary = new
                {
                    Present = presentCount,
                    Late = lateCount,
                    EarlyExit = earlyExitCount,
                    Absent = absentCount
                },
                WorklogSummary = new
                {
                    TotalHours = totalHoursWorkedThisMonth
                },
                LeaveBalance = leaveBalance,
                SalaryPreview = salaryPreview,
                Documents = documents
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetUserFullProfile] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch full profile drawer data." });
        }
    }
}

public class UpdateStatusRequest
{
    public int EmpId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}
