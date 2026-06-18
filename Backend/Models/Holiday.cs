using System;

namespace Backend.Models;

public class Holiday
{
    public int HolidayId { get; set; }
    public DateTime HolidayDate { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "National Holiday";
    public int SpaceId { get; set; }
}
