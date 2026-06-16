namespace Backend.Models;
using System;

public class AuditLog
{
    public int LogId { get; set; }
    public int EmpId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
