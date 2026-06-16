namespace Backend.Models;

using System;

public class RecentWorklogDto
{
    public int LogId { get; set; }
    public int EmpId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal HoursWorked { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ClockIn { get; set; }
    public DateTime? ClockOut { get; set; }
    public DateTime? AttendanceDate { get; set; }
    public string? TaskTitle { get; set; }
}

public class RecentEmployeeDto
{
    public int EmpId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime DateOfJoining { get; set; }
    public string SpaceName { get; set; } = string.Empty;
}

public class AdminSummaryDto
{
    public int TotalEmployees { get; set; }
    public int PresentToday { get; set; }
    public int AbsentToday { get; set; }
    public decimal TotalPayroll { get; set; }
    public int PendingLeaves { get; set; }
    public int TotalSpaces { get; set; }
    public int ActiveContracts { get; set; }
}
