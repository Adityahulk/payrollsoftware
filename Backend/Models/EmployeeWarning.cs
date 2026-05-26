namespace Backend.Models;

public class EmployeeWarning
{
    public int WarningId { get; set; }
    public int? EmpId { get; set; }
    public required string WarningText { get; set; }
    public decimal? PenaltyAmount { get; set; }
    public int? IssuedBy { get; set; }
}
