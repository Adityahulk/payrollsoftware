namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin")]
public class SuperAdminController : ControllerBase
{
    private readonly ISuperAdminRepository _repo;

    public SuperAdminController(ISuperAdminRepository repo)
    {
        _repo = repo;
    }

    /// <summary>
    /// GET /api/SuperAdmin/admins — All admins with space + usage stats + approval info
    /// </summary>
    [HttpGet("admins")]
    public async Task<IActionResult> GetAllAdmins()
    {
        try
        {
            var admins = await _repo.GetAllAdminsAsync();
            return Ok(admins);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] GetAllAdmins error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch admins." });
        }
    }

    /// <summary>
    /// GET /api/SuperAdmin/admins/pending — Admins awaiting approval
    /// </summary>
    [HttpGet("admins/pending")]
    public async Task<IActionResult> GetPendingAdmins()
    {
        try
        {
            var pending = await _repo.GetPendingAdminsAsync();
            return Ok(pending);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] GetPendingAdmins error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch pending admins." });
        }
    }

    /// <summary>
    /// GET /api/SuperAdmin/admins/{id} — Single admin detail
    /// </summary>
    [HttpGet("admins/{id}")]
    public async Task<IActionResult> GetAdminById(int id)
    {
        try
        {
            var admin = await _repo.GetAdminByIdAsync(id);
            if (admin == null)
                return NotFound(new { message = "Admin not found." });
            return Ok(admin);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] GetAdminById error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch admin." });
        }
    }

    /// <summary>
    /// PATCH /api/SuperAdmin/admins/{id}/approve — Approve admin
    /// </summary>
    [HttpPatch("admins/{id}/approve")]
    public async Task<IActionResult> ApproveAdmin(int id)
    {
        try
        {
            var success = await _repo.ApproveAdminAsync(id);
            if (!success)
                return NotFound(new { message = "Admin not found or already approved." });

            return Ok(new { message = "Admin approved successfully." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] ApproveAdmin error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to approve admin." });
        }
    }

    /// <summary>
    /// PATCH /api/SuperAdmin/admins/{id}/revoke — Revoke admin access
    /// </summary>
    [HttpPatch("admins/{id}/revoke")]
    public async Task<IActionResult> RevokeAdmin(int id, [FromBody] RevokeRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest(new { message = "A reason is required when revoking an admin." });

            string status = string.IsNullOrWhiteSpace(request.Status) ? "Suspended" : request.Status;

            var success = await _repo.RevokeAdminAsync(id, status, request.Reason);
            if (!success)
                return NotFound(new { message = "Admin not found." });

            return Ok(new { message = $"Admin access revoked. Status set to {status}. All employee operations under this admin are now restricted." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] RevokeAdmin error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to revoke admin." });
        }
    }

    /// <summary>
    /// PATCH /api/SuperAdmin/admins/{id}/status — Change admin status
    /// </summary>
    [HttpPatch("admins/{id}/status")]
    public async Task<IActionResult> UpdateAdminStatus(int id, [FromBody] AdminStatusRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Status))
                return BadRequest(new { message = "Status is required." });

            if (request.Status.Trim().ToLower() != "active" && string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest(new { message = "A reason is required when setting status to Inactive or Suspended." });

            var success = await _repo.UpdateAdminStatusAsync(id, request.Status, request.Reason);
            if (!success)
                return BadRequest(new { message = "Invalid status or admin not found." });

            return Ok(new { message = $"Admin status updated to {request.Status}." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] UpdateAdminStatus error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to update admin status." });
        }
    }

    /// <summary>
    /// PATCH /api/SuperAdmin/admins/{id}/toggle-status — Toggle statusbysuperadmin
    /// </summary>
    [HttpPatch("admins/{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatusBySuperAdmin(int id, [FromBody] ToggleStatusRequest request)
    {
        try
        {
            var success = await _repo.ToggleStatusBySuperAdminAsync(id, request.StatusBySuperAdmin);
            if (!success)
                return NotFound(new { message = "Admin not found." });

            var statusText = request.StatusBySuperAdmin ? "granted" : "revoked";
            return Ok(new { message = $"Admin access {statusText}." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] ToggleStatusBySuperAdmin error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to toggle admin status." });
        }
    }

    /// <summary>
    /// PATCH /api/SuperAdmin/spaces/{spaceId}/limits — Update advisory limits
    /// </summary>
    [HttpPatch("spaces/{spaceId}/limits")]
    public async Task<IActionResult> UpdateSpaceLimits(int spaceId, [FromBody] SpaceLimitsRequest request)
    {
        try
        {
            if (!request.NumberOfEmployees.HasValue && !request.MaxSpaces.HasValue)
                return BadRequest(new { message = "Provide at least one limit to update." });

            var success = await _repo.UpdateSpaceLimitsAsync(spaceId, request.NumberOfEmployees, request.MaxSpaces);
            if (!success)
                return NotFound(new { message = "Space not found." });

            return Ok(new { message = "Space limits updated (advisory)." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] UpdateSpaceLimits error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to update space limits." });
        }
    }

    /// <summary>
    /// GET /api/SuperAdmin/stats — Platform-wide totals
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetPlatformStats()
    {
        try
        {
            var stats = await _repo.GetPlatformStatsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] GetPlatformStats error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to fetch platform stats." });
        }
    }

    /// <summary>
    /// PATCH /api/SuperAdmin/profile — Update SuperAdmin profile settings
    /// </summary>
    [HttpPatch("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] SuperAdminProfileUpdateRequest request)
    {
        try
        {
            var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(idClaim) || !int.TryParse(idClaim, out var superAdminId))
            {
                return Unauthorized(new { message = "Invalid token or unauthorized." });
            }

            var superAdmin = await _repo.GetSuperAdminByIdAsync(superAdminId);
            if (superAdmin == null)
            {
                return NotFound(new { message = "SuperAdmin account not found." });
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { message = "Email is required." });
            }
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "Name is required." });
            }

            // Check email uniqueness
            if (!string.Equals(superAdmin.Email, request.Email.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                var existing = await _repo.GetSuperAdminByEmailAsync(request.Email.Trim());
                if (existing != null && existing.Id != superAdminId)
                {
                    return BadRequest(new { message = "An account with this email already exists." });
                }
                superAdmin.Email = request.Email.Trim();
            }

            superAdmin.Name = request.Name.Trim();

            if (!string.IsNullOrEmpty(request.NewPassword))
            {
                if (string.IsNullOrEmpty(request.CurrentPassword))
                {
                    return BadRequest(new { message = "Current password is required to change password." });
                }

                // Decode Base64 password from frontend
                string decodedCurrentPassword;
                string decodedNewPassword;
                try
                {
                    decodedCurrentPassword = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(request.CurrentPassword));
                }
                catch (FormatException)
                {
                    decodedCurrentPassword = request.CurrentPassword;
                }

                try
                {
                    decodedNewPassword = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(request.NewPassword));
                }
                catch (FormatException)
                {
                    decodedNewPassword = request.NewPassword;
                }

                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<object>();
                var verifyResult = hasher.VerifyHashedPassword(new object(), superAdmin.PasswordHash, decodedCurrentPassword);
                if (verifyResult != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success &&
                    verifyResult != Microsoft.AspNetCore.Identity.PasswordVerificationResult.SuccessRehashNeeded)
                {
                    return BadRequest(new { message = "Current password is incorrect." });
                }

                superAdmin.PasswordHash = hasher.HashPassword(new object(), decodedNewPassword);
            }

            var success = await _repo.UpdateSuperAdminAsync(superAdmin);
            if (!success)
            {
                return StatusCode(500, new { message = "Failed to update profile." });
            }

            return Ok(new
            {
                message = "Profile updated successfully.",
                email = superAdmin.Email,
                name = superAdmin.Name
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] UpdateProfile error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to update profile." });
        }
    }

    /// <summary>
    /// POST /api/SuperAdmin/create-superadmin — Create a new SuperAdmin account
    /// Step 1: Verify the calling SuperAdmin's own password
    /// Step 2: Create new SuperAdmin with provided email, name, password
    /// </summary>
    [HttpPost("create-superadmin")]
    public async Task<IActionResult> CreateSuperAdmin([FromBody] CreateSuperAdminRequest request)
    {
        try
        {
            // Identify the calling SuperAdmin
            var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(idClaim) || !int.TryParse(idClaim, out var callerSuperAdminId))
                return Unauthorized(new { message = "Invalid token or unauthorized." });

            var callerSuperAdmin = await _repo.GetSuperAdminByIdAsync(callerSuperAdminId);
            if (callerSuperAdmin == null)
                return NotFound(new { message = "Calling SuperAdmin account not found." });

            // Validate request fields
            if (string.IsNullOrWhiteSpace(request.YourPassword))
                return BadRequest(new { message = "Your current password is required." });
            if (string.IsNullOrWhiteSpace(request.NewEmail))
                return BadRequest(new { message = "New SuperAdmin email is required." });
            if (string.IsNullOrWhiteSpace(request.NewName))
                return BadRequest(new { message = "New SuperAdmin name is required." });
            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
                return BadRequest(new { message = "New SuperAdmin password must be at least 6 characters." });

            // Verify caller's own password
            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<object>();
            var verifyResult = hasher.VerifyHashedPassword(new object(), callerSuperAdmin.PasswordHash, request.YourPassword);
            if (verifyResult != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success &&
                verifyResult != Microsoft.AspNetCore.Identity.PasswordVerificationResult.SuccessRehashNeeded)
                return BadRequest(new { message = "Your password is incorrect. Cannot proceed." });

            // Check new email is not already taken
            var existing = await _repo.GetSuperAdminByEmailAsync(request.NewEmail.Trim());
            if (existing != null)
                return Conflict(new { message = "A SuperAdmin with this email already exists." });

            // Hash new password and create
            var newHash = hasher.HashPassword(new object(), request.NewPassword);
            var newId = await _repo.CreateSuperAdminAsync(request.NewEmail.Trim(), request.NewName.Trim(), newHash);

            Console.WriteLine($"[SuperAdmin] New SuperAdmin created: {request.NewEmail} by {callerSuperAdmin.Email}");
            return Ok(new
            {
                message = $"SuperAdmin '{request.NewName}' created successfully.",
                id = newId,
                email = request.NewEmail.Trim(),
                name = request.NewName.Trim()
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SuperAdmin] CreateSuperAdmin error: {ex.Message}");
            return StatusCode(500, new { message = "Failed to create SuperAdmin." });
        }
    }
}

public class CreateSuperAdminRequest
{
    public string YourPassword { get; set; } = string.Empty;
    public string NewEmail { get; set; } = string.Empty;
    public string NewName { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

