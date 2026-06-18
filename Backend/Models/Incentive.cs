namespace Backend.Models
{
    using System;

    public class Incentive
    {
        public int IncentiveId { get; set; }
        public int EmpId { get; set; }
        public int SpaceId { get; set; }
        public int AddedBy { get; set; }
        public decimal Amount { get; set; }
        public string? Type { get; set; }
        public string? Reason { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
