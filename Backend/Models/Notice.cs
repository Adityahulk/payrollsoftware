
namespace Backend.Models;

public class Notice
{
    public int NoticeId { get; set; }
    public int? AdminId { get; set; }
    public int? SpaceId { get; set; }
    public int? EmployeeId { get; set; }
    public required string NoticeText { get; set; }
    public required string ToType { get; set; }
    public DateTime? CreatedAt { get; set; }
    // Upgrade columns:
    public string? Preference { get; set; }
    public string? Reply { get; set; }
    public string Status { get; set; } = "Open";
    public int? RepliedBy { get; set; }
    public bool IsDeleted { get; set; } = false;
    
    // Real-Time Notification columns:
    public string? EventType { get; set; }
    public string? TargetRole { get; set; }
    public bool IsReadAdmin { get; set; } = false;
    public bool IsReadManager { get; set; } = false;
    public bool IsReadTl { get; set; } = false;
    public bool IsReadEmployee { get; set; } = false;
}
