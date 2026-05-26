namespace Backend.Models;

public class ProductivityScore
{
    public decimal AttendanceScore { get; set; }
    public decimal WorklogScore { get; set; }
    public decimal TaskScore { get; set; }
    public decimal TotalScore { get; set; } // The final productivity score
    public int LateMinutes { get; set; }
    public int EarlyExitMinutes { get; set; }
    public decimal TotalHours { get; set; } // actualWorkedHours
    public decimal ExpectedHours { get; set; }
}

public class PayrollImpact
{
    public decimal BaseSalary { get; set; }
    public decimal Deductions { get; set; }
    public decimal LatePenalty { get; set; }
    public decimal EarlyExitPenalty { get; set; }
    public decimal AdjustedSalary { get; set; }
    public decimal FinalSalary { get; set; }
}

public class PerformanceGrade
{
    public decimal ProductivityScore { get; set; }
    public string Grade { get; set; }
}
