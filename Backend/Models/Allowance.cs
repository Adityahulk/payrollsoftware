namespace Backend.Models;

using System;

public class Allowance
{
    public int AllowanceId { get; set; }
    public int AdminId { get; set; }
    public int SpaceId { get; set; }
    public required string Name { get; set; }
    public required string Type { get; set; } // Percentage / Fixed
    public decimal Value { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
