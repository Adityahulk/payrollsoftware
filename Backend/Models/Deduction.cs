namespace Backend.Models;

using System;

public class Deduction
{
    public int DeductionId { get; set; }
    public int AdminId { get; set; }
    public int SpaceId { get; set; }
    public required string Name { get; set; }
    public required string Type { get; set; } // Percentage / Fixed
    public decimal Value { get; set; }
    public string DeductionType { get; set; } = "Standard";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
