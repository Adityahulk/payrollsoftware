namespace Backend.Models;

using System;
using System.Collections.Generic;

/// <summary>
/// Structured salary slip response containing full breakdown of earnings,
/// deductions, worklog data, and final salary calculation.
/// </summary>
public class SalarySlip
{
    // ── Employee Info ──
    public int EmpId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string SpaceName { get; set; } = string.Empty;
    public int SpaceId { get; set; }

    // ── Period ──
    public int Month { get; set; }
    public int Year { get; set; }
    public string MonthName { get; set; } = string.Empty;

    // ── Earnings ──
    public decimal BaseSalary { get; set; }
    public List<SalaryLineItem> Allowances { get; set; } = new();
    public decimal TotalAllowances { get; set; }
    public decimal GrossSalary { get; set; }

    // ── Deductions ──
    public List<SalaryLineItem> Deductions { get; set; } = new();
    public decimal TotalDeductions { get; set; }

    // ── Worklog / Attendance ──
    public int TotalWorkingDays { get; set; }
    public int DaysPresent { get; set; }
    public int LeaveDays { get; set; }
    public decimal OvertimeHours { get; set; }

    // ── Net Salary ──
    public decimal NetSalary { get; set; }

    // ── Meta ──
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Generated"; // Generated / Paid
}

/// <summary>
/// A single line item in the earnings or deductions breakdown.
/// </summary>
public class SalaryLineItem
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "Fixed"; // Fixed / Percentage
    public decimal ConfiguredValue { get; set; } // The raw config value (e.g., 10 for 10%)
    public decimal CalculatedAmount { get; set; } // The actual computed amount
}
