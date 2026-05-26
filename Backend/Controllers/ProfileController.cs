namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Collections.Generic;
using Backend.Models;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly IProfileRepository _profileRepo;
    private readonly IUserRepository _userRepository;
    private readonly IWebHostEnvironment _env;

    public ProfileController(IProfileRepository profileRepo, IUserRepository userRepository, IWebHostEnvironment env)
    {
        _profileRepo = profileRepo;
        _userRepository = userRepository;
        _env = env;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole() =>
        User.FindFirst(ClaimTypes.Role)?.Value
        ?? User.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")?.Value
        ?? "";

    // ──────────────────────────────────────────────────────────────────
    // GET /api/Profile/photo/{empId}
    // ──────────────────────────────────────────────────────────────────
    [HttpGet("photo/{empId}")]
    [Authorize]
    public async Task<IActionResult> GetProfilePhoto(int empId)
    {
        var currentEmpId = GetEmpId();
        
        // Secure version: Only allow the logged-in user (or admins/managers if needed, but keeping it strict as requested)
        var role = GetRole();
        if (currentEmpId != empId && role != "Admin" && role != "Manager" && role != "TeamLead")
            return Unauthorized();

        var profile = await _profileRepo.GetProfileAsync(empId);
        if (profile == null || string.IsNullOrEmpty(profile.ProfilePhotoUrl))
            return NotFound();

        var fileName = Path.GetFileName(profile.ProfilePhotoUrl);
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var filePath = Path.Combine(webRoot, "profile-photo", fileName);

        if (!System.IO.File.Exists(filePath))
            return NotFound();

        var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
        
        var ext = Path.GetExtension(filePath).ToLower();
        var contentType = ext switch
        {
            ".png" => "image/png",
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return File(bytes, contentType);
    }

    // GET /api/Profile/me
    // ──────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    public async Task<IActionResult> GetMyProfile()
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized(new { message = "Invalid token." });

        var profile = await _profileRepo.GetProfileAsync(empId);
        if (profile == null) return NotFound(new { message = "Profile not found." });

        if (!string.IsNullOrEmpty(profile.ProfilePhotoUrl))
        {
            profile.ProfilePhotoUrl = $"http://localhost:5125/api/Profile/photo/{profile.EmpId}";
        }

        return Ok(profile);
    }

    // ──────────────────────────────────────────────────────────────────
    // GET /api/Profile/{empId}  — Admin/Manager/TL read-only
    // ──────────────────────────────────────────────────────────────────
    [HttpGet("{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetProfileByEmpId(int empId)
    {
        var profile = await _profileRepo.GetProfileAsync(empId);
        if (profile == null) return NotFound(new { message = "Profile not found." });

        if (!string.IsNullOrEmpty(profile.ProfilePhotoUrl))
        {
            profile.ProfilePhotoUrl = $"http://localhost:5125/api/Profile/photo/{profile.EmpId}";
        }

        return Ok(profile);
    }

    // ──────────────────────────────────────────────────────────────────
    // PUT /api/Profile/update/{empId?}
    // ──────────────────────────────────────────────────────────────────
    [HttpPut("update/{empId:int?}")]
    public async Task<IActionResult> UpdateProfile(int? empId, [FromBody] UpdateProfileRequest request)
    {
        var currentEmpId = GetEmpId();
        if (currentEmpId == 0) return Unauthorized(new { message = "Invalid token." });

        int targetEmpId = currentEmpId;
        if (empId.HasValue)
        {
            var role = GetRole();
            if (role != "Admin")
            {
                return Forbid();
            }
            targetEmpId = empId.Value;
        }

        // Email and Role cannot be changed via this endpoint — enforced by repository
        var updated = await _profileRepo.UpdateProfileAsync(targetEmpId, request);
        if (!updated) return NotFound(new { message = "Profile not found or no changes made." });

        return Ok(new { message = "Profile updated successfully." });
    }

    // ──────────────────────────────────────────────────────────────────
    // POST /api/Profile/photo
    // ──────────────────────────────────────────────────────────────────
    [HttpPost("photo")]
    public async Task<IActionResult> UploadPhoto([FromForm] IFormFile file)
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized(new { message = "Invalid token." });

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        // Validate image type
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/jpg", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { message = "Only JPEG, PNG, and WebP images are allowed." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "File size must be under 5 MB." });

        // Save to D:\Phase2\Backend\wwwroot\profile-photo\
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var folder = Path.Combine(webRoot, "profile-photo");
        Directory.CreateDirectory(folder);

        var ext = Path.GetExtension(file.FileName).ToLower();
        var fileName = $"emp_{empId}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{ext}";
        var filePath = Path.Combine(folder, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
            await file.CopyToAsync(stream);

        // Store relative URL path in DB
        var relativeUrl = $"/profile-photo/{fileName}";
        await _profileRepo.UpdateProfilePhotoAsync(empId, relativeUrl);

        return Ok(new { message = "Photo uploaded successfully.", photoUrl = $"http://localhost:5125/api/Profile/photo/{empId}" });
    }

    // ──────────────────────────────────────────────────────────────────
    // POST /api/Profile/documents
    // ──────────────────────────────────────────────────────────────────
    [HttpPost("documents")]
    public async Task<IActionResult> UploadDocuments([FromForm] List<string> documentTypes,
                                                      [FromForm] List<string> documentNumbers,
                                                      [FromForm] List<IFormFile> files)
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized(new { message = "Invalid token." });

        if (documentTypes == null || documentTypes.Count == 0)
            return BadRequest(new { message = "No document types provided." });

        if (documentTypes.Count != documentNumbers.Count || documentTypes.Count != files.Count)
            return BadRequest(new { message = "documentTypes, documentNumbers, and files arrays must have equal length." });

        // Fetch existing documents to check if mandatory docs are already saved
        var existingDocs = await _profileRepo.GetDocumentsByEmpIdAsync(empId);
        bool hasPan = existingDocs.Any(d => d.DocumentType.Trim().Equals("PAN", StringComparison.OrdinalIgnoreCase));
        bool hasAadhar = existingDocs.Any(d => d.DocumentType.Trim().Equals("Aadhar", StringComparison.OrdinalIgnoreCase));

        // Only require PAN/Aadhar if they don't already exist in the database
        var upperTypes = documentTypes.Select(t => t.Trim().ToUpper()).ToList();
        if (!hasPan && !upperTypes.Contains("PAN"))
            return BadRequest(new { message = "PAN document is mandatory." });
        if (!hasAadhar && !upperTypes.Contains("AADHAR"))
            return BadRequest(new { message = "Aadhar document is mandatory." });

        // Check for duplicates within request
        if (upperTypes.Distinct().Count() != upperTypes.Count)
            return BadRequest(new { message = "Duplicate document types are not allowed." });

        // Validate file sizes
        foreach (var f in files)
            if (f.Length > 10 * 1024 * 1024)
                return BadRequest(new { message = $"File '{f.FileName}' exceeds 10 MB limit." });

        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var folder = Path.Combine(webRoot, "Document");
        Directory.CreateDirectory(folder);

        var savedDocs = new List<object>();

        for (int i = 0; i < documentTypes.Count; i++)
        {
            var file = files[i];
            var ext = Path.GetExtension(file.FileName).ToLower();
            var safeType = string.Concat(documentTypes[i].Trim().Split(Path.GetInvalidFileNameChars()));
            var fileName = $"emp_{empId}_{safeType}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}{ext}";
            var filePath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
                await file.CopyToAsync(stream);

            var relativeUrl = $"/Document/{fileName}";

            var doc = new DocumentRecord
            {
                EmpId = empId,
                DocumentType = documentTypes[i].Trim(),
                DocumentNumber = documentNumbers[i].Trim(),
                FileUrl = relativeUrl,
            };

            var docId = await _profileRepo.SaveDocumentAsync(doc);
            savedDocs.Add(new { docId, documentType = doc.DocumentType, fileUrl = relativeUrl });
        }

        return Ok(new { message = "Documents saved successfully.", documents = savedDocs });
    }

    // ──────────────────────────────────────────────────────────────────
    // GET /api/Profile/documents
    // ──────────────────────────────────────────────────────────────────
    [HttpGet("documents")]
    public async Task<IActionResult> GetMyDocuments()
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();
        var docs = await _profileRepo.GetDocumentsByEmpIdAsync(empId);
        return Ok(docs);
    }

    // ──────────────────────────────────────────────────────────────────
    // DELETE /api/Profile/documents/{docId}
    // ──────────────────────────────────────────────────────────────────
    [HttpDelete("documents/{docId:int}")]
    public async Task<IActionResult> DeleteDocument(int docId)
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();
        var deleted = await _profileRepo.DeleteDocumentAsync(docId, empId);
        if (!deleted) return NotFound(new { message = "Document not found." });
        return Ok(new { message = "Document deleted." });
    }

    [HttpGet("debug-photos")]
    [AllowAnonymous]
    public async Task<IActionResult> DebugPhotos([FromServices] System.Data.IDbConnection db)
    {
        var sql = "SELECT empid, profilephotourl FROM t_users";
        var results = await Dapper.SqlMapper.QueryAsync(db, sql);
        return Ok(results);
    }

    [HttpPost("update-backup-email")]
    public async Task<IActionResult> UpdateBackupEmail([FromBody] UpdateBackupEmailRequest request)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            if (string.IsNullOrEmpty(request.BackupEmail))
                return BadRequest(new { message = "Backup email is required." });

            if (!System.Text.RegularExpressions.Regex.IsMatch(request.BackupEmail, @"^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$"))
                return BadRequest(new { message = "Invalid backup email format." });

            var success = await _userRepository.UpdateBackupEmailAsync(empId, request.BackupEmail);
            if (!success)
                return NotFound(new { message = "Profile not found." });

            return Ok(new { message = "Backup email updated successfully." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UpdateBackupEmail Error] {ex.Message}");
            return StatusCode(500, new { message = "Failed to update backup email." });
        }
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized(new { message = "Invalid token." });

            if (string.IsNullOrEmpty(request.OldPassword) || string.IsNullOrEmpty(request.NewPassword))
                return BadRequest(new { message = "Old password and new password are required." });

            if (request.NewPassword.Length < 6)
                return BadRequest(new { message = "New password must be at least 6 characters long." });

            var user = await _userRepository.GetUserByIdAsync(empId);
            if (user == null) return NotFound(new { message = "User not found." });

            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            var verifyResult = hasher.VerifyHashedPassword(user, user.PasswordHash ?? "", request.OldPassword);
            if (verifyResult == Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed)
            {
                if ((user.PasswordHash ?? "").Trim() != request.OldPassword.Trim())
                    return BadRequest(new { message = "Incorrect old password." });
            }

            string hashedNew = hasher.HashPassword(user, request.NewPassword);
            await _userRepository.UpdatePasswordHashAsync(empId, hashedNew);

            return Ok(new { message = "Password updated successfully." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ChangePassword Error] {ex.Message}");
            return StatusCode(500, new { message = "Failed to change password." });
        }
    }
}

public class UpdateBackupEmailRequest
{
    public string BackupEmail { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
