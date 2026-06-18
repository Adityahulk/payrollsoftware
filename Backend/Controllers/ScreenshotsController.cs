using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using System;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ScreenshotsController : ControllerBase
    {
        private readonly IScreenshotService _screenshotService;
        private readonly IWebHostEnvironment _env;
        private readonly IAuditLogService _auditLog;

        public ScreenshotsController(
            IScreenshotService screenshotService, 
            IWebHostEnvironment env, 
            IAuditLogService auditLog)
        {
            _screenshotService = screenshotService;
            _env = env;
            _auditLog = auditLog;
        }

        private int GetEmpId()
        {
            var claim = User.FindFirst("EmpId")?.Value
                     ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        private int GetSpaceId()
        {
            var claim = User.FindFirst("SpaceId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadScreenshot(IFormFile file)
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();

            if (empId == 0 || spaceId == 0)
            {
                return Unauthorized(new { message = "Invalid credentials or missing session context." });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "File was not provided or is empty." });
            }

            // Verify config is enabled for space
            var config = await _screenshotService.GetOrCreateConfigAsync(spaceId);
            if (!config.IsEnabled)
            {
                return BadRequest(new { message = "Screenshot monitoring is disabled for this space." });
            }

            try
            {
                var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var relativeFolder = Path.Combine("uploads", "screenshots", empId.ToString());
                var absoluteFolder = Path.Combine(webRoot, relativeFolder);

                Directory.CreateDirectory(absoluteFolder);

                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var fileName = $"{timestamp}.jpg";
                var filePath = Path.Combine(absoluteFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var fileUrl = $"/{relativeFolder.Replace(Path.DirectorySeparatorChar, '/')}/{fileName}";
                
                var screenshot = new Screenshot
                {
                    EmpId = empId,
                    SpaceId = spaceId,
                    FileUrl = fileUrl,
                    CapturedAt = DateTime.UtcNow
                };

                var screenshotId = await _screenshotService.SaveScreenshotAsync(screenshot);
                return Ok(new { message = "Screenshot uploaded successfully.", screenshotId, fileUrl });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Screenshot Upload Error] {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while saving the screenshot." });
            }
        }

        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            var spaceId = GetSpaceId();
            var empId = GetEmpId();
            if (spaceId == 0) return BadRequest(new { message = "User is not assigned to any space." });

            var config = await _screenshotService.GetOrCreateConfigAsync(spaceId, empId);
            return Ok(config);
        }

        [HttpPut("config")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateConfig([FromBody] ScreenshotConfig config)
        {
            var spaceId = GetSpaceId();
            var adminEmpId = GetEmpId();

            if (spaceId == 0) return BadRequest(new { message = "SpaceId context is missing." });

            config.SpaceId = spaceId;

            if (config.IntervalMinutes != 10 && config.IntervalMinutes != 20 && config.IntervalMinutes != 30 && config.IntervalMinutes != 60)
            {
                return BadRequest(new { message = "Interval must be either 10, 20, 30, or 60 minutes." });
            }

            var success = await _screenshotService.SaveConfigAsync(config);
            if (success)
            {
                await _auditLog.LogActionAsync(adminEmpId, "Update Screenshot Config", $"Set interval={config.IntervalMinutes}m, isEnabled={config.IsEnabled}", Request.HttpContext.Connection.RemoteIpAddress?.ToString());
                return Ok(new { message = "Configuration updated successfully." });
            }

            return BadRequest(new { message = "Failed to update configuration." });
        }

        [HttpGet("employee/{empId:int}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetEmployeeScreenshots(int empId, [FromQuery] string? date)
        {
            var spaceId = GetSpaceId();
            DateTime? parsedDate = null;
            if (!string.IsNullOrEmpty(date) && DateTime.TryParse(date, out var d))
            {
                parsedDate = d;
            }

            try
            {
                var screenshots = await _screenshotService.GetScreenshotsAsync(empId, parsedDate, spaceId);
                return Ok(screenshots);
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

        // =================================================================
        //  LIVE MONITORING — Upload, List, and 2-Month Rolling Purge
        // =================================================================

        /// <summary>
        /// POST /api/screenshots/monitoring/upload
        /// Accepts a screenshot IFormFile from the React live feed,
        /// saves it as a physical JPEG in wwwroot/LiveMonitoring/,
        /// stores the relative URL in PostgreSQL, then purges records older than 2 months.
        /// </summary>
        [HttpPost("monitoring/upload")]
        public async Task<IActionResult> UploadMonitoringScreenshot(IFormFile file)
        {
            var empId = GetEmpId();

            if (empId == 0)
            {
                return Unauthorized(new { message = "Invalid credentials or missing session context." });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "Screenshot file was not provided or is empty." });
            }

            try
            {
                // ── 1. Prepare the physical save path ──
                var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var monitoringFolder = Path.Combine(webRoot, "LiveMonitoring");
                Directory.CreateDirectory(monitoringFolder);

                // Generate a unique filename: emp_{empId}_{UnixTimestampMs}.jpg
                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var fileName = $"emp_{empId}_{timestamp}.jpg";
                var physicalPath = Path.Combine(monitoringFolder, fileName);

                // ── 2. Save the IFormFile to disk as a physical JPEG ──
                using (var stream = new FileStream(physicalPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // ── 3. Store the relative URL in the database ──
                var relativeUrl = $"/LiveMonitoring/{fileName}";
                var log = new EmployeeScreenshotLog
                {
                    EmpId = empId,
                    ScreenshotUrl = relativeUrl,
                    CapturedAt = DateTime.UtcNow
                };

                var logId = await _screenshotService.SaveScreenshotLogAsync(log);

                // ── 4. Run the 2-month rolling purge (DB + physical files) ──
                await PurgeExpiredScreenshotsInternal();

                return Ok(new
                {
                    message = "Monitoring screenshot saved successfully.",
                    logId,
                    screenshotUrl = relativeUrl
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Monitoring Upload Error] {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while saving the monitoring screenshot." });
            }
        }

        /// <summary>
        /// GET /api/screenshots/monitoring/{empId}?date=2026-06-14
        /// Lists all monitoring screenshot log entries for a specific employee.
        /// Admin and Manager roles only.
        /// </summary>
        [HttpGet("monitoring/{empId:int}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetMonitoringScreenshots(int empId, [FromQuery] string? date)
        {
            var spaceId = GetSpaceId();
            DateTime? parsedDate = null;
            if (!string.IsNullOrEmpty(date) && DateTime.TryParse(date, out var d))
            {
                parsedDate = d;
            }

            try
            {
                var logs = await _screenshotService.GetScreenshotLogsAsync(empId, parsedDate, spaceId);
                return Ok(logs);
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

        /// <summary>
        /// DELETE /api/screenshots/monitoring/purge
        /// Manual trigger for the 2-month rolling cleanup. Admin only.
        /// Deletes both physical files and database records older than 2 months.
        /// </summary>
        [HttpDelete("monitoring/purge")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> PurgeExpiredMonitoringScreenshots()
        {
            try
            {
                var deletedCount = await PurgeExpiredScreenshotsInternal();
                return Ok(new { message = $"Purge complete. {deletedCount} expired screenshot(s) removed." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Monitoring Purge Error] {ex.Message}");
                return StatusCode(500, new { message = "An error occurred during the purge operation." });
            }
        }

        /// <summary>
        /// Internal helper: Fetches expired records, deletes physical files, then deletes DB records.
        /// Called automatically after each upload AND can be triggered manually.
        /// </summary>
        private async Task<int> PurgeExpiredScreenshotsInternal()
        {
            // Step 1: Fetch all expired records (older than 2 months) to get file paths
            var expiredLogs = await _screenshotService.GetExpiredScreenshotLogsAsync();
            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");

            // Step 2: Delete the physical JPEG files from disk
            foreach (var log in expiredLogs)
            {
                try
                {
                    // Convert relative URL (/LiveMonitoring/emp_1_xxx.jpg) to absolute path
                    var relativePath = log.ScreenshotUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                    var fullPath = Path.Combine(webRoot, relativePath);

                    if (System.IO.File.Exists(fullPath))
                    {
                        System.IO.File.Delete(fullPath);
                        Console.WriteLine($"[Monitoring Purge] Deleted file: {fullPath}");
                    }
                }
                catch (Exception ex)
                {
                    // Log but don't fail the entire purge for a single file error
                    Console.WriteLine($"[Monitoring Purge Warning] Failed to delete file for LogId={log.LogId}: {ex.Message}");
                }
            }

            // Step 3: Bulk-delete the expired DB records
            var deletedCount = await _screenshotService.PurgeExpiredScreenshotLogsAsync();
            if (deletedCount > 0)
            {
                Console.WriteLine($"[Monitoring Purge] Removed {deletedCount} expired record(s) from database.");
            }

            return deletedCount;
        }
    }
}
