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
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserRepository _userRepository;

    public UserController(IUserRepository userRepository)
    {
        _userRepository = userRepository;
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
                return Unauthorized(new { message = "Unable to resolve employee identity from token" });

            var users = await _userRepository.GetUsersByCompanyAsync(empId.Value);
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
}

public class UpdateStatusRequest
{
    public int EmpId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}
