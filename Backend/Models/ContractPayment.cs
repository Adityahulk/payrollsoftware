namespace Backend.Models;

using System;

public class ContractPayment
{
    public int PaymentId { get; set; }
    public int SpaceId { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "UPI";
    public string Status { get; set; } = "Pending";
    public string? TransactionId { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
