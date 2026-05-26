namespace Backend.Models;

public class ProfileResponse
{
    public int EmpId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Gender { get; set; }
    public string? Role { get; set; }
    public string? Status { get; set; }
    public DateTime DateOfJoining { get; set; }
    public string? ProfilePhotoUrl { get; set; }
    public string? AccountNumber { get; set; }
    public string? BankName { get; set; }
    public string? AccountHolderName { get; set; }
    public string? IfscCode { get; set; }
    public string? UpiId { get; set; }
    public List<DocumentRecord> Documents { get; set; } = new();
}

public class DocumentRecord
{
    public int DocId { get; set; }
    public int EmpId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
}

public class UpdateProfileRequest
{
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Gender { get; set; }
    public string? Name { get; set; }
    public string? AccountNumber { get; set; }
    public string? BankName { get; set; }
    public string? AccountHolderName { get; set; }
    public string? IfscCode { get; set; }
    public string? UpiId { get; set; }
}
