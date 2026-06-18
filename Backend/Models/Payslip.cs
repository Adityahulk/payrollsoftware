namespace Backend.Models;

using System;

public class Payslip
{
    public int SlipId { get; set; }
    public int EmpId { get; set; }
    public int SpaceId { get; set; }
    public decimal BaseAmount { get; set; }
    public decimal Deduction { get; set; }
    public decimal FinalAmount { get; set; }
    public string Type { get; set; } = "Payroll"; // Payroll or Contract
    public int? PaymentId { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public int Month { get; set; } = 0;
    public int Year { get; set; } = 0;
    public decimal Basic { get; set; } = 0m;
    public decimal TotalAllowance { get; set; } = 0m;
    public decimal TotalDeduction { get; set; } = 0m;
    public string? Breakdown { get; set; }
    public string? PaymentMethod { get; set; }
    public string? TransactionId { get; set; }
    public string? AccountNumber { get; set; }
    public string? BankName { get; set; }
    public string? AccountHolderName { get; set; }
    public string? IfscCode { get; set; }
    public string? UpiId { get; set; }
    public string? EmployeeName { get; set; }
}

