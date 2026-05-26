namespace Backend.Models;

public class Salary
{
    public int SalaryId { get; set; }
    public int EmpId { get; set; }
    public decimal Basic { get; set; }
    public decimal Hra { get; set; }
    public decimal Da { get; set; }
    public decimal Pf { get; set; }
    public decimal Tds { get; set; }
}

public class BreakdownItem
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "Fixed"; // Fixed / Percentage
    public decimal Value { get; set; }
    public decimal Amount { get; set; }
    public string DeductionType { get; set; } = "Standard";
}

public class SalaryResponse
{
    public decimal Basic { get; set; }
    public decimal Hra { get; set; }
    public decimal Da { get; set; }
    public decimal Gross { get; set; }
    public decimal Pf { get; set; }
    public decimal Tds { get; set; }
    public decimal Net { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public List<BreakdownItem> Allowances { get; set; } = new();
    public List<BreakdownItem> Deductions { get; set; } = new();
}

public class TaskProgress
{
    public int TaskId { get; set; }
    public int ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal EstimatedHours { get; set; }
    public decimal ActualHours { get; set; }
    public decimal RemainingHours { get; set; }
    public int CompletionPercentage { get; set; }
    public string Status { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
}

public class ProgressReport
{
    public int TotalTasks { get; set; }
    public int CompletedTasks { get; set; }
    public int PendingTasks { get; set; }
    public decimal TotalHoursWorked { get; set; }
    public decimal AttendancePercentage { get; set; }
}

public class CtcSummaryResponse
{
    public int Year { get; set; }
    public decimal AnnualBasic { get; set; }
    public decimal AnnualHra { get; set; }
    public decimal AnnualDa { get; set; }
    public decimal AnnualGross { get; set; }
    public decimal AnnualPf { get; set; }
    public decimal AnnualTds { get; set; }
    public decimal AnnualNet { get; set; }
    public decimal MonthlyNet { get; set; }
}
