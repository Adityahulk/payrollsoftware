namespace Backend.Models;

public class Attendance
{
    public int AttendanceId { get; set; }
    public int? EmpId { get; set; }
    public DateTime? AttendanceDate { get; set; }
    public DateTime? ClockIn { get; set; }
    public DateTime? ClockOut { get; set; }
    public decimal? TotalHours { get; set; }
    public string? Status { get; set; }
    public int? LateMinutes { get; set; }
    public int? EarlyExitMinutes { get; set; }
    public decimal? BreakHours { get; set; }
    public DateTime? CreatedAt { get; set; }
}
