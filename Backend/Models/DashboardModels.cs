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
