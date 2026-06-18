using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using System;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using Backend.Services;
using Backend.Models;
using System.Collections.Generic;
using System.Linq;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MonitorController : ControllerBase
    {
        private readonly IScreenshotService _screenshotService;
        private readonly ISpaceService _spaceService;
        private readonly IWebHostEnvironment _env;

        public MonitorController(IScreenshotService screenshotService, ISpaceService spaceService, IWebHostEnvironment env)
        {
            _screenshotService = screenshotService;
            _spaceService = spaceService;
            _env = env;
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

        private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

        // ─────────────────────────────────────────────────────────────────────────
        //  GET /api/Monitor/space/{spaceId}/latest
        // ─────────────────────────────────────────────────────────────────────────
        [HttpGet("space/{spaceId:int}/latest")]
        [Authorize(Roles = "Admin,Manager,TeamLead")]
        public async Task<IActionResult> GetLatestScreenshots(int spaceId)
        {
            var adminId = GetEmpId();
            var role = GetRole();
            var callerSpaceId = GetSpaceId();

            if (adminId == 0)
                return Unauthorized(new { message = "Invalid admin session." });

            try
            {
                var space = await _spaceService.GetSpaceByIdAsync(spaceId, callerSpaceId, role);
                if (space == null)
                    return NotFound(new { message = "Space not found or inactive." });

                var results = await _screenshotService.GetLatestScreenshotsForSpaceAsync(spaceId);
                var checkedResults = results.Select(r =>
                {
                    if (!string.IsNullOrEmpty(r.LatestScreenshotUrl))
                    {
                        var relativePath = r.LatestScreenshotUrl.TrimStart('/');
                        var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", relativePath);
                        r.Status = System.IO.File.Exists(physicalPath) ? "available" : "missing";
                    }
                    else
                    {
                        r.Status = "missing";
                    }
                    return r;
                });
                return Ok(checkedResults);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to fetch latest screenshots.", details = ex.Message });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  GET /api/Monitor/config/{spaceId}   — get monitoring retention settings
        // ─────────────────────────────────────────────────────────────────────────
        [HttpGet("config/{spaceId:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetMonitorConfig(int spaceId, [FromQuery] int? empId = null)
        {
            try
            {
                var config = await _screenshotService.GetOrCreateConfigAsync(spaceId, empId);
                return Ok(new
                {
                    spaceId = config.SpaceId,
                    empId = config.EmpId,
                    intervalMinutes = config.IntervalMinutes,
                    isEnabled = config.IsEnabled,
                    screenshotRetentionDays = config.ScreenshotRetentionDays,
                    videoRetentionMinutes = config.VideoRetentionMinutes,
                    updatedAt = config.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load monitoring config.", details = ex.Message });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  PUT /api/Monitor/config/{spaceId}   — save monitoring retention settings
        // ─────────────────────────────────────────────────────────────────────────
        [HttpPut("config/{spaceId:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SaveMonitorConfig(int spaceId, [FromBody] MonitorConfigRequest req, [FromQuery] int? empId = null)
        {
            if (req == null)
                return BadRequest(new { message = "Request body is required." });

            // Validate bounds
            if (req.IntervalMinutes < 1 || req.IntervalMinutes > 1440)
                return BadRequest(new { message = "Capture interval must be between 1 and 1440 minutes (1 day max)." });
            if (req.ScreenshotRetentionDays < 1 || req.ScreenshotRetentionDays > 365)
                return BadRequest(new { message = "Screenshot retention must be between 1 and 365 days." });
            if (req.VideoRetentionMinutes < 1 || req.VideoRetentionMinutes > 10080)
                return BadRequest(new { message = "Video retention must be between 1 minute and 10080 minutes (1 week max)." });

            try
            {
                var config = new ScreenshotConfig
                {
                    SpaceId = spaceId,
                    EmpId = empId,
                    IntervalMinutes = req.IntervalMinutes,
                    IsEnabled = req.IsEnabled,
                    ScreenshotRetentionDays = req.ScreenshotRetentionDays,
                    VideoRetentionMinutes = req.VideoRetentionMinutes,
                };
                await _screenshotService.SaveConfigAsync(config);

                Console.WriteLine($"[MonitorConfig] Space {spaceId} (Emp: {empId}) → screenshot_retention={req.ScreenshotRetentionDays}d, video_retention={req.VideoRetentionMinutes}min, interval={req.IntervalMinutes}min");

                return Ok(new
                {
                    message = "Monitoring settings saved successfully.",
                    spaceId,
                    empId,
                    screenshotRetentionDays = req.ScreenshotRetentionDays,
                    videoRetentionMinutes = req.VideoRetentionMinutes,
                    intervalMinutes = req.IntervalMinutes,
                    isEnabled = req.IsEnabled,
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to save monitoring config.", details = ex.Message });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  POST /api/Monitor/upload   — employee uploads a screenshot
        // ─────────────────────────────────────────────────────────────────────────
        [HttpPost("upload")]
        public async Task<IActionResult> UploadScreenshot(IFormFile? file, IFormFile? imageFile)
        {
            var empId = GetEmpId();
            if (empId == 0)
                return Unauthorized(new { message = "Invalid credentials or missing session context." });

            var uploadFile = file ?? imageFile;
            if (uploadFile == null || uploadFile.Length == 0)
                return BadRequest(new { message = "Screenshot file was not provided or is empty." });

            try
            {
                var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var monitoringFolder = Path.Combine(webRoot, "LiveMonitoring");
                Directory.CreateDirectory(monitoringFolder);

                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var fileName = $"emp_{empId}_{timestamp}.jpg";
                var physicalPath = Path.Combine(monitoringFolder, fileName);

                using (var stream = new FileStream(physicalPath, FileMode.Create))
                {
                    await uploadFile.CopyToAsync(stream);
                }

                var relativeUrl = $"/LiveMonitoring/{fileName}";
                var log = new EmployeeScreenshotLog
                {
                    EmpId = empId,
                    ScreenshotUrl = relativeUrl,
                    CapturedAt = DateTime.UtcNow
                };

                var logId = await _screenshotService.SaveScreenshotLogAsync(log);

                // ── Dynamic purge: load config for this employee's space ──────────
                await PurgeDynamicAsync(empId, webRoot);

                return Ok(new { message = "Screenshot saved.", logId, screenshotUrl = relativeUrl });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Monitor Upload Error] {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while saving the monitoring screenshot." });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  POST /api/Monitor/upload-video   — employee uploads a video chunk
        // ─────────────────────────────────────────────────────────────────────────
        [HttpPost("upload-video")]
        public async Task<IActionResult> UploadVideo(IFormFile? videoFile, IFormFile? file)
        {
            var empId = GetEmpId();
            if (empId == 0)
                return Unauthorized(new { message = "Invalid credentials or missing session context." });

            var uploadFile = videoFile ?? file;
            if (uploadFile == null || uploadFile.Length == 0)
                return BadRequest(new { message = "Video file was not provided or is empty." });

            try
            {
                var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                var monitoringFolder = Path.Combine(webRoot, "LiveMonitoring");
                Directory.CreateDirectory(monitoringFolder);

                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var fileName = $"emp_{empId}_{timestamp}.webm";
                var physicalPath = Path.Combine(monitoringFolder, fileName);

                using (var stream = new FileStream(physicalPath, FileMode.Create))
                {
                    await uploadFile.CopyToAsync(stream);
                }

                var relativeUrl = $"/LiveMonitoring/{fileName}";
                var log = new EmployeeVideoLog
                {
                    EmpId = empId,
                    VideoUrl = relativeUrl,
                    CapturedAt = DateTime.UtcNow
                };

                var logId = await _screenshotService.SaveVideoLogAsync(log);

                // ── Dynamic purge: load config for this employee's space ──────────
                await PurgeDynamicAsync(empId, webRoot);

                return Ok(new { message = "Video chunk saved.", logId, videoUrl = relativeUrl });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Monitor Video Upload Error] {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while saving the monitoring video." });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  GET /api/Monitor/employee/{empId}/history
        //  Uses the admin-configured retention settings to show ALL stored
        //  screenshots/videos within the retention window (e.g., 60 days of SS).
        // ─────────────────────────────────────────────────────────────────────────
        [HttpGet("employee/{empId:int}/history")]
        [Authorize(Roles = "Admin,Manager,TeamLead")]
        public async Task<IActionResult> GetEmployeeHistory(int empId)
        {
            var adminId = GetEmpId();
            if (adminId == 0)
                return Unauthorized(new { message = "Invalid user session." });

            try
            {
                // Load the employee's space-level monitoring config to get retention settings
                var callerSpaceId = GetSpaceId();
                int screenshotRetentionDays = 60; // default
                int videoRetentionMinutes = 15;   // default

                try
                {
                    var config = await _screenshotService.GetOrCreateConfigAsync(callerSpaceId, empId);
                    screenshotRetentionDays = config.ScreenshotRetentionDays > 0 ? config.ScreenshotRetentionDays : 60;
                    videoRetentionMinutes = config.VideoRetentionMinutes > 0 ? config.VideoRetentionMinutes : 15;
                }
                catch { /* use defaults if config lookup fails */ }

                // Convert screenshot retention from days to minutes for the query
                int screenshotMinutes = screenshotRetentionDays * 24 * 60;

                var screenshots = await _screenshotService.GetRecentScreenshotLogsAsync(empId, screenshotMinutes, callerSpaceId);
                var videos = await _screenshotService.GetRecentVideoLogsAsync(empId, videoRetentionMinutes, callerSpaceId);

                return Ok(new
                {
                    screenshots,
                    videos,
                    screenshotRetentionDays,
                    videoRetentionMinutes
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to fetch employee history.", details = ex.Message });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  GET /api/Monitor/employee-activity
        // ─────────────────────────────────────────────────────────────────────────
        [HttpGet("employee-activity")]
        [Authorize(Roles = "Admin,Manager,TeamLead")]
        public async Task<IActionResult> GetEmployeeActivity([FromQuery] int empid, [FromQuery] int spaceid)
        {
            var adminId = GetEmpId();
            var role = GetRole();
            var callerSpaceId = GetSpaceId();

            if (adminId == 0)
                return Unauthorized(new { message = "Invalid user session." });

            try
            {
                var space = await _spaceService.GetSpaceByIdAsync(spaceid, callerSpaceId, role);
                if (space == null)
                    return NotFound(new { message = "Space not found or inactive." });

                // Load the employee's space-level monitoring config to get retention settings
                int screenshotRetentionDays = 60; // default
                int videoRetentionMinutes = 15;   // default

                try
                {
                    var config = await _screenshotService.GetOrCreateConfigAsync(spaceid, empid);
                    screenshotRetentionDays = config.ScreenshotRetentionDays > 0 ? config.ScreenshotRetentionDays : 60;
                    videoRetentionMinutes = config.VideoRetentionMinutes > 0 ? config.VideoRetentionMinutes : 15;
                }
                catch { /* use defaults if config lookup fails */ }

                // Convert screenshot retention from days to minutes for the query
                int screenshotMinutes = screenshotRetentionDays * 24 * 60;

                var screenshots = await _screenshotService.GetRecentScreenshotLogsAsync(empid, screenshotMinutes, spaceid);
                var videos = await _screenshotService.GetRecentVideoLogsAsync(empid, videoRetentionMinutes, spaceid);

                // Map results to the exact JSON structure requested:
                // { empid, employee_name, file_path, created_at, status }
                var screenshotResults = screenshots.Select(s =>
                {
                    var relativeUrl = s.ScreenshotUrl.TrimStart('/');
                    var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", relativeUrl);
                    var exists = System.IO.File.Exists(physicalPath);
                    var status = exists ? "available" : "missing";

                    return new
                    {
                        logid = s.LogId,
                        empid = s.EmpId,
                        employee_name = s.EmployeeName,
                        screenshot_url = s.ScreenshotUrl,
                        file_path = s.ScreenshotUrl,
                        created_at = s.CapturedAt,
                        status = status
                    };
                });

                var videoResults = videos.Select(v =>
                {
                    var relativeUrl = v.VideoUrl.TrimStart('/');
                    var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", relativeUrl);
                    var exists = System.IO.File.Exists(physicalPath);
                    var status = exists ? "available" : "missing";

                    return new
                    {
                        logid = v.LogId,
                        empid = v.EmpId,
                        employee_name = v.EmployeeName,
                        video_url = v.VideoUrl,
                        file_path = v.VideoUrl,
                        created_at = v.CapturedAt,
                        status = status
                    };
                });

                return Ok(new
                {
                    screenshots = screenshotResults,
                    videos = videoResults,
                    screenshotRetentionDays,
                    videoRetentionMinutes
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to fetch employee activity.", details = ex.Message });
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  INTERNAL — Dynamic purge using per-space retention config
        // ─────────────────────────────────────────────────────────────────────────
        private async Task PurgeDynamicAsync(int empId, string webRoot)
        {
            try
            {
                // Look up employee's space config for accurate per-space retention
                int screenshotRetentionDays = 60;
                int videoRetentionMinutes = 15;

                try
                {
                    // Use JWT spaceId for accurate per-space config lookup
                    var callerSpaceId = GetSpaceId();
                    if (callerSpaceId > 0)
                    {
                        var config = await _screenshotService.GetOrCreateConfigAsync(callerSpaceId, empId);
                        screenshotRetentionDays = config.ScreenshotRetentionDays > 0 ? config.ScreenshotRetentionDays : 60;
                        videoRetentionMinutes = config.VideoRetentionMinutes > 0 ? config.VideoRetentionMinutes : 15;
                    }
                }
                catch { /* use defaults */ }

                // Purge screenshots older than retention period
                var expiredScreenshots = await _screenshotService.GetExpiredScreenshotLogsDynamicAsync(screenshotRetentionDays);
                foreach (var log in expiredScreenshots)
                {
                    try
                    {
                        var rel = log.ScreenshotUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                        var full = Path.Combine(webRoot, rel);
                        if (System.IO.File.Exists(full)) System.IO.File.Delete(full);
                    }
                    catch (Exception ex) { Console.WriteLine($"[Purge] Screenshot file delete failed: {ex.Message}"); }
                }
                await _screenshotService.PurgeExpiredScreenshotLogsDynamicAsync(screenshotRetentionDays);

                // Purge videos older than retention period
                var expiredVideos = await _screenshotService.GetExpiredVideoLogsDynamicAsync(videoRetentionMinutes);
                foreach (var log in expiredVideos)
                {
                    try
                    {
                        var rel = log.VideoUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                        var full = Path.Combine(webRoot, rel);
                        if (System.IO.File.Exists(full)) System.IO.File.Delete(full);
                    }
                    catch (Exception ex) { Console.WriteLine($"[Purge] Video file delete failed: {ex.Message}"); }
                }
                await _screenshotService.PurgeExpiredVideoLogsDynamicAsync(videoRetentionMinutes);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Dynamic Purge Error] {ex.Message}");
            }
        }
    }

    /// <summary>Request body for saving monitor settings.</summary>
    public class MonitorConfigRequest
    {
        public int IntervalMinutes { get; set; } = 30;
        public bool IsEnabled { get; set; } = true;
        /// <summary>Days to retain screenshot files. Default: 60.</summary>
        public int ScreenshotRetentionDays { get; set; } = 60;
        /// <summary>Minutes before video chunks are auto-deleted. Default: 15.</summary>
        public int VideoRetentionMinutes { get; set; } = 15;
    }
}
