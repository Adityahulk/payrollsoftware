namespace Backend.Models;

public class User
{
    public int EmpId { get; set; }
    public int? SpaceId { get; set; }
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public string? Gender { get; set; }
    public string? Status { get; set; }
    public string? Role { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public DateTime DateOfJoining { get; set; }
    public string? AccountNumber { get; set; }
    public string? BankName { get; set; }
    public string? AccountHolderName { get; set; }
    public string? IfscCode { get; set; }
    public string? UpiId { get; set; }
    public string? Name { get; set; }
    public string? BackupEmail { get; set; }
    public bool StatusBySuperAdmin { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("password")]
    public string? Password { get; set; }
}
