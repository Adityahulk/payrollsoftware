namespace Backend.Models;

public class ProjectTask
{
    public int TaskId { get; set; }
    public int? ProjectId { get; set; }
    public int? AssignedToEmpId { get; set; }
    public required string TaskTitle { get; set; }
    public required string TaskDescription { get; set; }
    public required string TaskStatus { get; set; }   // Pending/InProgress/Completed
    public required string Priority { get; set; }     // Low/Medium/High/Critical
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? WorkingHours { get; set; }            // Estimated hours given by TL
    public decimal? EstimatedHours { get; set; }      // alias used by worklog progress
    public string? ProjectName { get; set; }           // Joined from t_projects for My Tasks view
    public DateTime? CreatedAt { get; set; }
}
