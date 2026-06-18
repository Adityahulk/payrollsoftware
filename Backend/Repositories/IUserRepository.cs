namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface IUserRepository
{
    Task<IEnumerable<User>> GetAllUsersAsync();
    Task<User?> GetUserByIdAsync(int empid);
    Task<User?> GetUserByEmailAsync(string email);
    Task<IEnumerable<User>> SearchUsersAsync(string searchTerm);
    Task<int> CreateUserAsync(User user);
    Task<bool> UpdateUserAsync(User user);
    Task<bool> UpdateUserStatusAsync(int empId, string status);
    Task<bool> DeleteUserAsync(int empid);
    Task<int> CreateSpaceAsync(string spaceName, int adminId);
    Task<bool> UpdateUserSpaceIdAsync(int empId, int spaceId);
    
    // Warnings
    Task<int> AddWarningAsync(EmployeeWarning warning);
    Task<IEnumerable<EmployeeWarning>> GetWarningsByUserIdAsync(int empid);

    // Dynamic Space-Isolated User Fetching
    Task<IEnumerable<User>> GetUsersForManagerAsync(int empId, string role, int? spaceId);
    Task<IEnumerable<User>> GetUsersBySpaceIdAsync(int spaceId);
    Task<IEnumerable<User>> GetUsersByAdminSpacesAsync(int adminId);
    Task<IEnumerable<User>> GetUsersByCompanyAsync(int empId);
    Task<bool> UpdateBackupEmailAsync(int empId, string backupEmail);
    Task<bool> UpdatePasswordHashAsync(int empId, string passwordHash);
    Task<int> CreateOtpAsync(int empId, string otp, DateTime expiresAt);
    Task<dynamic?> GetActiveOtpAsync(int empId, string otp);
    Task<bool> MarkOtpAsUsedAsync(int otpId);
    Task<bool> IsUserUnderAdminAsync(int targetEmpId, int adminEmpId);
}
