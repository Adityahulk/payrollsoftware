namespace Backend.Models;

using System;

public class PayrollPayment
{
    public int PaymentId { get; set; }
    public int EmpId { get; set; }
    public int SpaceId { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Deduction { get; set; }
    public decimal FinalAmount { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsManual { get; set; } = false;
    public decimal AllowanceAmount { get; set; } = 0m;
    public decimal DeductionAmount { get; set; } = 0m;
    public string? PaymentMethod { get; set; }
    public string? TransactionId { get; set; }
    public Guid? GroupId { get; set; }
}
