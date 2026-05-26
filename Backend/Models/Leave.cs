namespace Backend.Models;
using System;

public class Leave
{
    public int LeaveId { get; set; }
    public int EmpId { get; set; }
    public int SpaceId { get; set; }
    public DateTime LeaveDate { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = "Pending";   // Pending | Approved | Rejected
    public string LeaveType { get; set; } = "Normal"; // Normal | Emergency | College
    public bool HalfDay { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public int? ApprovedBy { get; set; }
}

public class LeaveRequest
{
    public string LeaveDate { get; set; } = "";   // YYYY-MM-DD, must be today or future
    public string? Reason { get; set; }
    public string LeaveType { get; set; } = "Normal";
    public bool HalfDay { get; set; } = false;
}

public class UpdateLeaveStatusRequest
{
    public string Status { get; set; } = ""; // Approved | Rejected
}

public class LeaveBalanceResponse
{
    public int AllowedEmergency { get; set; }
    public int AllowedCollege { get; set; }
    public int UsedEmergency { get; set; }
    public int UsedCollege { get; set; }
    public int RemainingEmergency { get; set; }
    public int RemainingCollege { get; set; }
}

public class SpaceLeaveConfig
{
    public int ConfigId { get; set; }
    public int SpaceId { get; set; }
    public int EmergencyLeavesPerMonth { get; set; } = 1;
    public int CollegeLeavesPerMonth { get; set; } = 1;
    public int NormalLeavesPerMonth { get; set; } = 999;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
