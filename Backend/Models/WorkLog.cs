namespace Backend.Models;

public class WorkLog
{
    public int LogId { get; set; }
    public int EmpId { get; set; }
    public int TaskId { get; set; }
    public decimal HoursWorked { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
}

public class WorkLogDetail
{
    public int LogId { get; set; }
    public decimal HoursWorked { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
}

public class WorkLogRequest
{
    public int TaskId { get; set; }
    public decimal HoursWorked { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? TaskStatus { get; set; }
}

public class WorklogChartDto
{
    public string Label { get; set; } = string.Empty;
    public decimal BeforeBreak { get; set; }
    public decimal Break { get; set; }
    public decimal AfterBreak { get; set; }
    public decimal Missing { get; set; }
}

public class EmployeeDailyActivityDto
{
    public int EmpId { get; set; }
    public DateTime Date { get; set; }
    public DateTime? ClockIn { get; set; }
    public DateTime? ClockOut { get; set; }
    public decimal? TotalHours { get; set; }
    public decimal? MissingHours { get; set; }
    public List<WorklogItemDto> Worklogs { get; set; } = new();
    public List<ScreenshotDto> Screenshots { get; set; } = new();
}

public class WorklogItemDto
{
    public int LogId { get; set; }
    public int TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public decimal HoursWorked { get; set; }
    public string Description { get; set; } = string.Empty;
}

public class ScreenshotDto
{
    public int ScreenshotId { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public DateTime CapturedAt { get; set; }
}

public class EmployeeDailyActivityRaw
{
    public int EmpId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public DateTime? ClockIn { get; set; }
    public DateTime? ClockOut { get; set; }
    public decimal? TotalHours { get; set; }
    public int? LogId { get; set; }
    public int? TaskId { get; set; }
    public string? TaskName { get; set; }
    public decimal? HoursWorked { get; set; }
    public string? Description { get; set; }
}
