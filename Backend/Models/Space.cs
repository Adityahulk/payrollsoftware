namespace Backend.Models;

using System.Text.Json;
using System.Text.Json.Serialization;

public class Space
{
    public int SpaceId { get; set; }
    public required string SpaceName { get; set; }
    public int? AdminId { get; set; }
    public int? NumberOfEmployees { get; set; }
    public DateTime? CreatedAt { get; set; }
    public bool IsActive { get; set; } = true;
    public int? TotalEmployees { get; set; }
    public int? NumberOfBreaks { get; set; }
    public int? BreakTime { get; set; }
    public TimeOnly? WorkStartTime { get; set; }
    public TimeOnly? WorkEndTime { get; set; }
    public int? WorkingHours { get; set; }
    public string Type { get; set; } = "Department";
    public DateTime? EndDate { get; set; }

    /// <summary>
    /// Raw TEXT column from database (JSON array string). Mapped by Dapper.
    /// </summary>
    [JsonIgnore]
    public string? WorkingDays { get; set; }

    /// <summary>
    /// Deserialized list for JSON API serialization.
    /// Getter parses WorkingDays; setter serializes back to WorkingDays.
    /// </summary>
    [JsonPropertyName("workingDays")]
    public List<string>? WorkingDaysList
    {
        get
        {
            if (string.IsNullOrWhiteSpace(WorkingDays)) return null;
            try { return JsonSerializer.Deserialize<List<string>>(WorkingDays); }
            catch { return null; }
        }
        set
        {
            WorkingDays = value != null && value.Count > 0
                ? JsonSerializer.Serialize(value)
                : null;
        }
    }

    private static readonly List<string> DefaultWorkingDays = new() { "Mon", "Tue", "Wed", "Thu", "Fri" };

    /// <summary>
    /// Always returns a usable list of working days, falling back to Mon-Fri.
    /// </summary>
    public List<string> GetWorkingDaysList()
    {
        var list = WorkingDaysList;
        return (list != null && list.Count > 0) ? list : DefaultWorkingDays;
    }

    /// <summary>
    /// Maps a .NET DayOfWeek enum to the short day name used in workingDays.
    /// </summary>
    public static string DayOfWeekToShortName(DayOfWeek dow) => dow switch
    {
        DayOfWeek.Sunday => "Sun",
        DayOfWeek.Monday => "Mon",
        DayOfWeek.Tuesday => "Tue",
        DayOfWeek.Wednesday => "Wed",
        DayOfWeek.Thursday => "Thu",
        DayOfWeek.Friday => "Fri",
        DayOfWeek.Saturday => "Sat",
        _ => ""
    };
}
