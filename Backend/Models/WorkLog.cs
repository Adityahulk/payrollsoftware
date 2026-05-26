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
