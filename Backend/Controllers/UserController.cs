namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System.Linq;
using System;
using Backend.Models;
using Backend.Repositories;

using Microsoft.Extensions.DependencyInjection;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly ISalaryRepository _salaryRepo;
    private readonly ILeaveRepository _leaveRepo;
    private readonly IWorklogRepository _worklogRepo;
    private readonly IAttendanceRepository _attendanceRepo;
    private readonly IProfileRepository _profileRepo;

    [ActivatorUtilitiesConstructor]
    public UserController(
        IUserRepository userRepository,
        ISalaryRepository salaryRepo,
        ILeaveRepository leaveRepo,
        IWorklogRepository worklogRepo,
        IAttendanceRepository attendanceRepo,
        IProfileRepository profileRepo)
    {
        _userRepository = userRepository;
        _salaryRepo = salaryRepo;
        _leaveRepo = leaveRepo;
        _worklogRepo = worklogRepo;
        _attendanceRepo = attendanceRepo;
        _profileRepo = profileRepo;
    }

    /// <summary>
    /// Extracts the integer EmpId from JWT claims, handling both custom "EmpId" and standard NameIdentifier claims.
    /// </summary>
    private async Task<int?> ResolveEmpIdAsync()
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value 
                         ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                         ?? User.FindFirst("nameid")?.Value;

        if (string.IsNullOrEmpty(empIdClaim))
            return null;

        if (int.TryParse(empIdClaim, out int empId))
            return empId;

        // Fallback: claim may be email-based
        var userByEmail = await _userRepository.GetUserByEmailAsync(empIdClaim);
        return userByEmail?.EmpId;
    }

    // GET /api/User — Admin ONLY: full company user listing
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllUsers()
    {
        try
        {
            var empId = await ResolveEmpIdAsync();
            if (!empId.HasValue)
                return Unauthorized(new { message = "Unable to resolve employee identity from token" });

            var users = await _userRepository.GetUsersByCompanyAsync(empId.Value);
            return Ok(users);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetAllUsers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch users" });
        }
    }

    // GET /api/User/company — All authenticated roles: read-only company employee directory
    [HttpGet("company")]
    [Authorize(Roles = "Admin,Manager,TeamLead,Employee")]
    public async Task<IActionResult> GetCompanyUsers()
    {
        try
        {
            var empId = await ResolveEmpIdAsync();
            if (!empId.HasValue)
            {
                Console.WriteLine("[GetCompanyUsers] Failed to resolve empId from token.");
                return Unauthorized(new { message = "Unable to resolve employee identity from token" });
            }

            Console.WriteLine($"[GetCompanyUsers] Resolved empId: {empId.Value}");
            var users = await _userRepository.GetUsersByCompanyAsync(empId.Value);
            Console.WriteLine($"[GetCompanyUsers] Found {users.Count()} users in company.");
            return Ok(users);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetCompanyUsers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch company users" });
        }
    }

    // GET /api/User/team — TeamLead/Manager: all employees under same Admin (via space chain)
    // Logic: JWT empId → spaceid → adminid → all spaces by admin → all users in those spaces
    [HttpGet("team")]
    [Authorize(Roles = "Admin,TeamLead,Manager")]
    public async Task<IActionResult> GetTeamMembers()
    {
        try
        {
            var empId = await ResolveEmpIdAsync();
            if (!empId.HasValue)
                return Unauthorized(new { message = "Unable to resolve employee identity from token" });

            var users = await _userRepository.GetUsersByCompanyAsync(empId.Value);
            return Ok(users);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetTeamMembers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch team members" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        try
        {
            var user = await _userRepository.GetUserByIdAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });
            return Ok(user);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetUserById] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch user" });
        }
    }

    [HttpGet("search")]
    [Authorize(Roles = "Admin,TeamLead,Manager")]
    public async Task<IActionResult> SearchUsers([FromQuery] string query)
    {
        try
        {
            var empId = await ResolveEmpIdAsync();
            if (!empId.HasValue)
                return Unauthorized();

            // Search within company-scoped users only
            var companyUsers = await _userRepository.GetUsersByCompanyAsync(empId.Value);
            var searchLower = (query ?? "").Trim().ToLower();

            if (string.IsNullOrEmpty(searchLower))
                return Ok(companyUsers);

            var filtered = companyUsers.Where(u =>
                (u.Email?.ToLower().Contains(searchLower) == true) ||
                (u.Role?.ToLower().Contains(searchLower) == true)
            );

            return Ok(filtered);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.SearchUsers] Error: {ex.Message}");
            return StatusCode(500, new { message = "Search failed" });
        }
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUser([FromBody] User user)
    {
        try
        {
            if (user == null)
                return BadRequest(new { message = "User data is required" });

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

            var userId = await _userRepository.CreateUserAsync(user);
            return CreatedAtAction(nameof(GetUserById), new { id = userId }, user);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.CreateUser] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to create user" });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] User user)
    {
        try
        {
            user.EmpId = id;
            var result = await _userRepository.UpdateUserAsync(user);
            if (!result) return NotFound(new { message = "User not found" });
            return NoContent();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.UpdateUser] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to update user" });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        try
        {
            var result = await _userRepository.DeleteUserAsync(id);
            if (!result) return NotFound(new { message = "User not found" });
            return NoContent();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.DeleteUser] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to delete user" });
        }
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateUserStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        try
        {
            var user = await _userRepository.GetUserByIdAsync(id);
            if (user == null) return NotFound(new { message = "User not found" });

            var result = await _userRepository.UpdateUserStatusAsync(id, request.Status);
            if (!result) return BadRequest(new { message = "Invalid status value. Allowed: Active, Inactive, Pending" });

            // Log a warning if deactivating with a reason
            if (request.Status?.Trim().Equals("Inactive", StringComparison.OrdinalIgnoreCase) == true 
                && !string.IsNullOrEmpty(request.Reason))
            {
                var adminEmpId = await ResolveEmpIdAsync();

                await _userRepository.AddWarningAsync(new EmployeeWarning
                {
                    EmpId = id,
                    WarningText = $"Account deactivated. Reason: {request.Reason}",
                    PenaltyAmount = 0,
                    IssuedBy = adminEmpId ?? 0
                });
            }

            return Ok(new { message = "Status updated successfully" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.UpdateUserStatus] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to update status" });
        }
    }

    [HttpPost("{id}/warnings")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddWarning(int id, [FromBody] EmployeeWarning warning)
    {
        try
        {
            warning.EmpId = id;
            var warningId = await _userRepository.AddWarningAsync(warning);
            return Ok(new { WarningId = warningId });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.AddWarning] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to issue warning" });
        }
    }

    [HttpGet("{id}/warnings")]
    public async Task<IActionResult> GetWarnings(int id)
    {
        try
        {
            var warnings = await _userRepository.GetWarningsByUserIdAsync(id);
            return Ok(warnings);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetWarnings] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch warnings" });
        }
    }

    private int? ResolveSpaceId()
    {
        var spaceIdClaim = User.FindFirst("SpaceId")?.Value;
        if (int.TryParse(spaceIdClaim, out int spaceId))
            return spaceId;
        return null;
    }

    // GET /api/User/space — Enforce space-level boundary for Managers/TLs
    [HttpGet("space")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetUsersBySpace()
    {
        try
        {
            var empId = await ResolveEmpIdAsync();
            if (!empId.HasValue) return Unauthorized();

            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value 
                       ?? User.FindFirst("role")?.Value;

            if (role == "Admin")
            {
                var users = await _userRepository.GetUsersByCompanyAsync(empId.Value);
                return Ok(users);
            }
            else
            {
                var spaceId = ResolveSpaceId();
                if (!spaceId.HasValue) return BadRequest(new { message = "No space assigned to supervisor." });

                var users = await _userRepository.GetUsersBySpaceIdAsync(spaceId.Value);
                // Exclude Admin from supervisor view
                var filtered = users.Where(u => (u.Role ?? "").ToLower() != "admin");
                return Ok(filtered);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UserController.GetUsersBySpace] Error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch space users" });
        }
    }

    // PUT /api/User/toggle-status/{id}
    [HttpPut("toggle-status/{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> ToggleUserStatus(int id)
    {
        try
        {
            var user = await _userRepository.GetUserByIdAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value 
                       ?? User.FindFirst("role")?.Value;

            if (role == "Manager")
            {
                var spaceId = ResolveSpaceId();
                if (user.SpaceId != spaceId)
                {
                    return Forbid("Access denied. You can only toggle users in your own space.");
                }
            }

            var newStatus = (user.Status ?? "Active").Equals("Active", StringComparison.OrdinalIgnoreCase) 
                ? "Inactive" 
                : "Active";

            var result = await _userRepository.UpdateUserStatusAsync(id, newStatus);
            if (!result) return BadRequest(new { message = "Failed to update status." });

            return Ok(new { message = $"User status successfully toggled to {newStatus}.", status = newStatus });
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
            var user = await _userRepository.GetUserByIdAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });

            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value 
                       ?? User.FindFirst("role")?.Value;

            if (role == "Manager" || role == "TeamLead")
            {
                var spaceId = ResolveSpaceId();
                if (user.SpaceId != spaceId)
                {
                    return Forbid("Access denied. You can only view profiles within your own space.");
                }
            }

            int month = DateTime.UtcNow.Month;
            int year = DateTime.UtcNow.Year;

            // Fetch dynamic Leave Balance
            var leaveBalance = await _leaveRepo.GetLeaveBalanceAsync(id);

            // Fetch dynamic total worklog hours
            decimal totalHoursWorkedThisMonth = 0m;
            try
            {
                var worklogs = await _worklogRepo.GetWorklogsByEmpIdAsync(id);
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
            var salaryPreview = await _salaryRepo.GetSalaryAsync(id, month, year);

            // Fetch attendance summary stats this month
            int presentCount = 0;
            int lateCount = 0;
            int earlyExitCount = 0;
            int absentCount = 0;

            if (salaryPreview != null)
            {
                var attendanceRecords = await _attendanceRepo.GetAttendanceByUserIdAsync(id);
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
            try { documents = await _profileRepo.GetDocumentsByEmpIdAsync(id); }
            catch (Exception ex) { Console.WriteLine($"[FullProfile] Documents warning: {ex.Message}"); }

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
