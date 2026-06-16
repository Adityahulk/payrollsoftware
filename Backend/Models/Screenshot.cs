namespace Backend.Models;
using System;

public class Screenshot
{
    public int ScreenshotId { get; set; }
    public int EmpId { get; set; }
    public int SpaceId { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
}

public class ScreenshotConfig
{
    public int Id { get; set; }
    public int SpaceId { get; set; }
    public int? EmpId { get; set; }
    public int IntervalMinutes { get; set; } = 30;
    public bool IsEnabled { get; set; } = false;
    /// <summary>How many days to keep screenshot files/logs. Default: 60 (≈ 2 months).</summary>
    public int ScreenshotRetentionDays { get; set; } = 60;
    /// <summary>How many minutes before video recording chunks are auto-deleted. Default: 15.</summary>
    public int VideoRetentionMinutes { get; set; } = 15;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class EmployeeScreenshotLog
{
    public int LogId { get; set; }
    public int EmpId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public int? UserSpaceId { get; set; }
    public int? UserEmpId { get; set; }
    public string? UserEmail { get; set; }
    public string ScreenshotUrl { get; set; } = string.Empty;
    public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
}

public class EmployeeVideoLog
{
    public int LogId { get; set; }
    public int EmpId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public int? UserSpaceId { get; set; }
    public int? UserEmpId { get; set; }
    public string? UserEmail { get; set; }
    public string VideoUrl { get; set; } = string.Empty;
    public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
}

public class EmployeeLatestScreenshot
{
    public int EmpId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? LatestScreenshotUrl { get; set; }
    public DateTime? CapturedAt { get; set; }
    public string Status { get; set; } = "available";
}
