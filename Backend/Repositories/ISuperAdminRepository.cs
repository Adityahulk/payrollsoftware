namespace Backend.Repositories;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;

public class AdminListItem
{
    public int EmpId { get; set; }
    public string? Email { get; set; }
    public string? Name { get; set; }
    public string? Status { get; set; }
    public string? Gender { get; set; }
    public bool StatusBySuperAdmin { get; set; }
    public DateTime DateOfJoining { get; set; }

    // Space info
    public int? SpaceId { get; set; }
    public string? SpaceName { get; set; }

    // Counts
    public int CurrentSpaceCount { get; set; }     // number of spaces owned by this admin
    public int CurrentEmployeeCount { get; set; }  // number of employees under this admin
}

public class PlatformStats
{
    public int TotalAdmins { get; set; }
    public int ActiveAdmins { get; set; }
    public int PendingAdmins { get; set; }
    public int SuspendedAdmins { get; set; }
    public int InactiveAdmins { get; set; }
    public int TotalSpaces { get; set; }
    public int TotalEmployees { get; set; }
    public int ActiveEmployees { get; set; }
    public int PendingEmployees { get; set; }
}

public class AdminStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class RevokeRequest
{
    public string? Status { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class SpaceLimitsRequest
{
    public int? NumberOfEmployees { get; set; }
    public int? MaxSpaces { get; set; }
}

public class ToggleStatusRequest
{
    public bool StatusBySuperAdmin { get; set; }
}

public class SuperAdmin
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SuperAdminProfileUpdateRequest
{
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? CurrentPassword { get; set; }
    public string? NewPassword { get; set; }
}

public interface ISuperAdminRepository
{
    Task<IEnumerable<AdminListItem>> GetAllAdminsAsync();
    Task<IEnumerable<AdminListItem>> GetPendingAdminsAsync();
    Task<AdminListItem?> GetAdminByIdAsync(int empId);
    Task<bool> ApproveAdminAsync(int empId);
    Task<bool> RevokeAdminAsync(int empId, string status, string reason);
    Task<bool> UpdateAdminStatusAsync(int empId, string status, string? reason);
    Task<bool> ToggleStatusBySuperAdminAsync(int empId, bool status);
    Task<bool> UpdateSpaceLimitsAsync(int spaceId, int? numberOfEmployees, int? maxSpaces);
    Task<PlatformStats> GetPlatformStatsAsync();
    Task<SuperAdmin?> GetSuperAdminByEmailAsync(string email);
    Task<SuperAdmin?> GetSuperAdminByIdAsync(int id);
    Task<bool> UpdateSuperAdminAsync(SuperAdmin superAdmin);
    Task<int> CreateSuperAdminAsync(string email, string name, string passwordHash);
}
