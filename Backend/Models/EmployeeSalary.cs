namespace Backend.Models;

using System;

public class EmployeeSalary
{
    public int SalaryId { get; set; }
    public int EmpId { get; set; }
    public int SpaceId { get; set; }
    public decimal Basic { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
