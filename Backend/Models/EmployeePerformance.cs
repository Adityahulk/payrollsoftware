namespace Backend.Models
{
    using System;

    public class EmployeePerformance
    {
        public int PerformanceId { get; set; }
        public int EmpId { get; set; }
        public int SpaceId { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public int TasksCompleted { get; set; }
        public int TasksPending { get; set; }
        public int LateMinutes { get; set; }
        public int EarlyExitMinutes { get; set; }
        public decimal AttendanceScore { get; set; }
        public decimal OverallScore { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
