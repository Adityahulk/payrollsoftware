namespace Backend.Models;
using System;

public class BonusTask
{
    public int TaskId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SpaceId { get; set; }
    public decimal BonusAmount { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Completed, Paid
    public int? AssignedTo { get; set; }
    public DateTime? CompletedAt { get; set; }
}
