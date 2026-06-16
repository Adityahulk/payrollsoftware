namespace Backend.Models;

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

public class Project
{
    public int ProjectId { get; set; }
    public int? CreatedById { get; set; }       // EmpId of TL who created
    public int? AdminId { get; set; }           // EmpId of the space Admin (company link)
    public int? SpaceId { get; set; }           // Space link
    public required string ProjectName { get; set; }
    public string? Description { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? TeamId { get; set; }
    public DateTime? CreatedAt { get; set; }

    [JsonIgnore]
    public string? LinksRaw { get; set; }

    [JsonIgnore]
    public string? DocLinksRaw { get; set; }

    [JsonPropertyName("links")]
    public string[]? Links
    {
        get
        {
            if (string.IsNullOrWhiteSpace(LinksRaw)) return Array.Empty<string>();
            var trimmed = LinksRaw.Trim();
            if (trimmed.StartsWith("{") && trimmed.EndsWith("}"))
            {
                return trimmed.Trim('{', '}').Split(',', StringSplitOptions.RemoveEmptyEntries);
            }
            try
            {
                return JsonSerializer.Deserialize<string[]>(trimmed);
            }
            catch
            {
                return new[] { trimmed };
            }
        }
        set
        {
            LinksRaw = value != null ? JsonSerializer.Serialize(value) : null;
        }
    }

    [JsonPropertyName("documentationLinks")]
    public string[]? DocumentationLinks
    {
        get
        {
            if (string.IsNullOrWhiteSpace(DocLinksRaw)) return Array.Empty<string>();
            var trimmed = DocLinksRaw.Trim();
            if (trimmed.StartsWith("{") && trimmed.EndsWith("}"))
            {
                return trimmed.Trim('{', '}').Split(',', StringSplitOptions.RemoveEmptyEntries);
            }
            try
            {
                return JsonSerializer.Deserialize<string[]>(trimmed);
            }
            catch
            {
                return new[] { trimmed };
            }
        }
        set
        {
            DocLinksRaw = value != null ? JsonSerializer.Serialize(value) : null;
        }
    }
}

// DTO for creating a project with tasks in a single API call
public class CreateProjectWithTasksDto
{
    public required string ProjectName { get; set; }
    public string? Description { get; set; }
    public string[]? Links { get; set; }
    public string[]? DocumentationLinks { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? TeamId { get; set; }
    public int? SpaceId { get; set; }
    public List<TaskDto> Tasks { get; set; } = new();
}

public class TaskDto
{
    public int AssignedToEmpId { get; set; }
    public required string TaskTitle { get; set; }
    public string? TaskDescription { get; set; }
    public string? Priority { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public int? WorkingHours { get; set; }
}
