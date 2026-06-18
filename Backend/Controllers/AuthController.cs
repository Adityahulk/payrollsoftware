namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly IConfiguration _configuration;
    private readonly Backend.Services.INotificationService _notificationService;
    private readonly Backend.Repositories.ISuperAdminRepository _superAdminRepository;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;
    private readonly Resend.IResend _resend;

    public AuthController(
        IUserRepository userRepository,
        IConfiguration configuration,
        Backend.Services.INotificationService notificationService,
        Backend.Repositories.ISuperAdminRepository superAdminRepository,
        Microsoft.Extensions.Caching.Memory.IMemoryCache cache,
        Resend.IResend resend)
    {
        _userRepository = userRepository;
        _configuration = configuration;
        _notificationService = notificationService;
        _superAdminRepository = superAdminRepository;
        _cache = cache;
        _resend = resend;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var user = await _userRepository.GetUserByEmailAsync(request.Email);

            if (user == null)
            {
                // Fallback: Check if this is a SuperAdmin login
                var superAdmin = await _superAdminRepository.GetSuperAdminByEmailAsync(request.Email.Trim());
                if (superAdmin == null)
                {
                    return Unauthorized(new { message = "Invalid email or password" });
                }

                // Verify SuperAdmin password
                var superHasher = new Microsoft.AspNetCore.Identity.PasswordHasher<object>();
                var verifySuperResult = superHasher.VerifyHashedPassword(new object(), superAdmin.PasswordHash, request.Password);
                if (verifySuperResult != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success &&
                    verifySuperResult != Microsoft.AspNetCore.Identity.PasswordVerificationResult.SuccessRehashNeeded)
                {
                    return Unauthorized(new { message = "Invalid email or password" });
                }

                // Generate JWT with SuperAdmin role
                var superUser = new User
                {
                    EmpId = superAdmin.Id,
                    Email = superAdmin.Email,
                    Role = "SuperAdmin",
                    SpaceId = 0
                };
                var superToken = GenerateJwtToken(superUser);

                return Ok(new
                {
                    Token = superToken,
                    Role = superUser.Role,
                    EmpId = superUser.EmpId,
                    SpaceId = superUser.SpaceId,
                    Name = superAdmin.Name,
                    Email = superAdmin.Email
                });
            }

            if (string.IsNullOrEmpty(user.PasswordHash))
                return StatusCode(500, "Password missing in DB");

            // Secure PBKDF2 Password Verification with Old Plain-Text Fallback and Auto-Migration
            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            bool isVerified = false;
            bool shouldMigrate = false;

            try
            {
                var verifyResult = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
                if (verifyResult == Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success || 
                    verifyResult == Microsoft.AspNetCore.Identity.PasswordVerificationResult.SuccessRehashNeeded)
                {
                    isVerified = true;
                }
            }
            catch (Exception)
            {
                // FormatException occurs if the passwordhash field holds a legacy plain-text string (not a valid Base64 hash)
                isVerified = false;
            }

            // Fallback plain-text check if not verified yet
            if (!isVerified)
            {
                if (user.PasswordHash.Trim() == request.Password.Trim())
                {
                    isVerified = true;
                    shouldMigrate = true;
                }
            }

            if (!isVerified)
            {
                return Unauthorized(new { message = "Invalid email or password" });
            }

            // Auto-migrate if plain-text password match was authenticated
            if (shouldMigrate)
            {
                try
                {
                    string secureHash = hasher.HashPassword(user, request.Password);
                    await _userRepository.UpdatePasswordHashAsync(user.EmpId, secureHash);
                    System.Console.WriteLine($"[Auth Migration] Automatically migrated legacy plain-text password to secure hash for user {user.Email}");
                }
                catch (Exception ex)
                {
                    System.Console.WriteLine($"[Auth Migration Error] Failed to auto-migrate password hash for user {user.Email}: {ex.Message}");
                }
            }

            if (user.Status == "Pending")
                return Unauthorized(new { message = "Your account is pending approval by the admin." });

            // SuperAdmin access control — ONLY for Admin role
            // Employees, TL, Managers are NOT affected
            if (user.Role == "Admin" && !user.StatusBySuperAdmin)
                return StatusCode(403, new { message = "Access restricted by SuperAdmin. Contact MTI support." });

            // SAFE JWT CLAIM VALUES
            var safeUser = new User
            {
                EmpId = user.EmpId,
                Email = user.Email,
                Role = user.Role ?? "Employee",
                SpaceId = user.SpaceId ?? 0
            };

            var token = GenerateJwtToken(safeUser);

            return Ok(new
            {
                Token = token,
                Role = safeUser.Role,
                EmpId = safeUser.EmpId,
                SpaceId = safeUser.SpaceId,
                Name = user.Name ?? user.Email
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine("LOGIN ERROR FULL: " + ex.ToString()); // DEBUG LINE
            return StatusCode(500, "Internal Server Error");
        }
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            // Check if email already exists
            var existing = await _userRepository.GetUserByEmailAsync(request.Email);
            if (existing != null)
                return Conflict(new { message = "An account with this email already exists." });

            string role = request.Role ?? "Employee";
            string status = role == "Admin" ? "Active" : "Pending";

            // Validate role-based fields
            if (role == "Admin" && string.IsNullOrEmpty(request.SpaceName))
            {
                return BadRequest(new { message = "Space name is required for Admin registration" });
            }
            if (role != "Admin" && !request.SpaceId.HasValue)
            {
                return BadRequest(new { message = "Space ID is required for non-Admin registration" });
            }

            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            var newUser = new User
            {
                Email        = request.Email,
                Name         = request.Name ?? (request.Email.Contains("@") ? request.Email.Split('@')[0] : "New User"),
                PasswordHash = hasher.HashPassword(null!, request.Password),
                Role         = role,
                SpaceId      = role == "Admin" ? null : request.SpaceId,
                Gender       = request.Gender ?? "Unknown",
                Status       = status,
                Phone        = request.Phone,
                Address      = request.Address,
                DateOfJoining = DateTime.Today  // Automatic date setting
            };

            var empId = await _userRepository.CreateUserAsync(newUser);
            newUser.EmpId = empId;

            if (role == "Admin" && !string.IsNullOrEmpty(request.SpaceName))
            {
                int newSpaceId = await _userRepository.CreateSpaceAsync(request.SpaceName, empId);
                newUser.SpaceId = newSpaceId;
                await _userRepository.UpdateUserSpaceIdAsync(empId, newSpaceId);
            }

            try
            {
                await _notificationService.NotifyRegisterAsync(empId, newUser.Email, newUser.Role ?? "Employee", newUser.SpaceId ?? 0);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Notification Trigger Error] Register: {ex.Message}");
            }

            var token = GenerateJwtToken(newUser);
            return Ok(new { Token = token, Role = newUser.Role, EmpId = empId, SpaceId = newUser.SpaceId, Name = newUser.Name ?? newUser.Email, Status = newUser.Status });
        }
        catch (Exception ex)
        {
            System.IO.File.WriteAllText("error_log.txt", ex.ToString());
            return StatusCode(500, new { message = "Registration failed", error = ex.Message, details = ex.InnerException?.Message });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Email))
                return BadRequest(new { message = "Email is required" });

            var emailNormalized = request.Email.Trim();
            var emailKey = emailNormalized.ToLowerInvariant();
            var user = await _userRepository.GetUserByEmailAsync(emailNormalized);
            var superAdmin = await _superAdminRepository.GetSuperAdminByEmailAsync(emailNormalized);

            // "Do NOT expose if email exists or not (security best practice)"
            if (user == null && superAdmin == null)
            {
                return Ok(new { message = "If your email is registered in our system, a 6-digit OTP has been sent." });
            }

            // Generate 6-digit OTP
            var rand = new Random();
            string otp = rand.Next(100000, 999999).ToString();
            string targetEmail = emailNormalized;
            bool isSuperAdmin = superAdmin != null;

            if (!isSuperAdmin && user != null)
            {
                var expiresAt = DateTime.UtcNow.AddMinutes(5); // valid for 5 minutes
                await _userRepository.CreateOtpAsync(user.EmpId, otp, expiresAt);
                targetEmail = !string.IsNullOrEmpty(user.BackupEmail) ? user.BackupEmail : user.Email!;
            }
            else
            {
                // SuperAdmin OTP - store in cache for 30 minutes
                targetEmail = superAdmin?.Email ?? emailNormalized;
                var cacheKey = $"SA_OTP_{emailKey}";
                _cache.Set(cacheKey, otp, TimeSpan.FromMinutes(30));
            }

            // Send Email via Resend SDK
            try
            {
                var message = new Resend.EmailMessage();
                message.From = "VeriFind <otp@support.payrollmicrotechnique.store>";
                message.To.Add(targetEmail);
                message.Subject = "Password Reset OTP";
                message.HtmlBody = $@"
                    <div style='font-family:sans-serif'>
                        <h2>Your OTP Code</h2>
                        <h1>{otp}</h1>
                        <p>This OTP is valid for {(isSuperAdmin ? "30" : "5")} minutes.</p>
                    </div>";

                await _resend.EmailSendAsync(message);
                System.Console.WriteLine($"[Resend SDK] Successfully sent password reset OTP to {targetEmail}. OTP: {otp}");
            }
            catch (Exception ex)
            {
                System.Console.WriteLine("==========================================================================");
                System.Console.WriteLine($"[Resend DEV MOCK] FAILED TO SEND REAL EMAIL via SDK: {ex.Message}");
                System.Console.WriteLine($"[Resend DEV MOCK] TARGET: {targetEmail}");
                System.Console.WriteLine($"[Resend DEV MOCK] SUBJECT: Password Reset OTP");
                System.Console.WriteLine($"[Resend DEV MOCK] BODY: Your OTP is: {otp}");
                System.Console.WriteLine("==========================================================================");
            }

            return Ok(new { message = "If your email is registered in our system, a 6-digit OTP has been sent." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ForgotPassword Error] {ex.Message}");
            return StatusCode(500, new { message = "Failed to initiate password reset." });
        }
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Otp))
                return BadRequest(new { message = "Email and OTP are required" });

            var emailNormalized = request.Email.Trim();
            var emailKey = emailNormalized.ToLowerInvariant();
            var user = await _userRepository.GetUserByEmailAsync(emailNormalized);
            var superAdmin = await _superAdminRepository.GetSuperAdminByEmailAsync(emailNormalized);

            if (user == null && superAdmin == null)
                return BadRequest(new { message = "Invalid email or OTP." });

            if (superAdmin != null)
            {
                // SuperAdmin Verification
                var cacheKey = $"SA_OTP_{emailKey}";
                if (_cache.TryGetValue(cacheKey, out string? cachedOtp) && cachedOtp == request.Otp.Trim())
                {
                    // Store verification token in cache for 30 minutes
                    var verifiedKey = $"SA_VERIFIED_{emailKey}";
                    _cache.Set(verifiedKey, request.Otp.Trim(), TimeSpan.FromMinutes(30));
                    return Ok(new { message = "OTP verified successfully. You may now reset your password." });
                }
                return BadRequest(new { message = "Invalid or expired OTP." });
            }
            else
            {
                // Standard User Verification
                var otpRecord = await _userRepository.GetActiveOtpAsync(user!.EmpId, request.Otp.Trim());
                if (otpRecord == null)
                {
                    return BadRequest(new { message = "Invalid, expired, or already used OTP." });
                }
                return Ok(new { message = "OTP verified successfully. You may now reset your password." });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[VerifyOtp Error] {ex.Message}");
            return StatusCode(500, new { message = "OTP verification failed." });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Otp) || string.IsNullOrEmpty(request.NewPassword))
                return BadRequest(new { message = "Email, OTP, and new password are required" });

            var emailNormalized = request.Email.Trim();
            var emailKey = emailNormalized.ToLowerInvariant();
            var user = await _userRepository.GetUserByEmailAsync(emailNormalized);
            var superAdmin = await _superAdminRepository.GetSuperAdminByEmailAsync(emailNormalized);

            if (user == null && superAdmin == null)
                return BadRequest(new { message = "Invalid request." });

            if (superAdmin != null)
            {
                // Verify SuperAdmin token in cache
                var verifiedKey = $"SA_VERIFIED_{emailKey}";
                if (!_cache.TryGetValue(verifiedKey, out string? cachedVerifiedOtp) || cachedVerifiedOtp != request.Otp.Trim())
                {
                    return BadRequest(new { message = "Invalid or expired OTP session." });
                }

                // Update SuperAdmin Password
                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<object>();
                string hashedNew = hasher.HashPassword(new object(), request.NewPassword);
                superAdmin.PasswordHash = hashedNew;
                await _superAdminRepository.UpdateSuperAdminAsync(superAdmin);

                // Clear cache entries
                _cache.Remove($"SA_OTP_{emailKey}");
                _cache.Remove(verifiedKey);

                return Ok(new { message = "Password reset successfully. You can now login with your new password." });
            }
            else
            {
                // Standard User Reset
                var otpRecord = await _userRepository.GetActiveOtpAsync(user!.EmpId, request.Otp.Trim());
                if (otpRecord == null)
                {
                    return BadRequest(new { message = "Invalid or expired OTP session." });
                }

                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                string hashedNew = hasher.HashPassword(user, request.NewPassword);
                await _userRepository.UpdatePasswordHashAsync(user.EmpId, hashedNew);

                // Mark OTP as used
                int otpId = 0;
                if (otpRecord is IDictionary<string, object> dict)
                {
                    if (dict.TryGetValue("id", out var idVal) || dict.TryGetValue("Id", out idVal))
                    {
                        otpId = Convert.ToInt32(idVal);
                    }
                }
                if (otpId > 0)
                {
                    await _userRepository.MarkOtpAsUsedAsync(otpId);
                }

                // Broadcast real-time PasswordReset notification
                try
                {
                    await _notificationService.NotifyPasswordResetAsync(user.EmpId, user.Email ?? "", user.SpaceId ?? 0);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[PasswordReset Notification Error] {ex.Message}");
                }

                return Ok(new { message = "Password reset successfully. You can now login with your new password." });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ResetPassword Error] {ex.Message}");
            return StatusCode(500, new { message = "Failed to reset password." });
        }
    }

    private string GenerateJwtToken(User user)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? "DefaultKeyForDevelopmentOnly"));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.EmpId.ToString()),
            new Claim("EmpId", user.EmpId.ToString()),
            new Claim(ClaimTypes.Role, user.Role ?? "Employee"),
            new Claim("SpaceId", user.SpaceId?.ToString() ?? "")
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.Now.AddHours(2),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class LoginRequest
{
    public required string Email    { get; set; }
    public required string Password { get; set; }
}

public class RegisterRequest
{
    public required string Email    { get; set; }
    public required string Password { get; set; }
    public string? Role     { get; set; }   // defaults to "Employee"
    public int? SpaceId     { get; set; }
    public string? SpaceName { get; set; }
    public string? Gender   { get; set; }
    public string? Name     { get; set; }
    public string? Phone    { get; set; }
    public string? Address  { get; set; }
}

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}

public class VerifyOtpRequest
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
