using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

namespace Backend.Services
{
    public interface IUserService
    {
        Task<IEnumerable<User>> GetUsersByCompanyAsync(int empId, int callerSpaceId, string callerRole);
        Task<User?> GetUserByIdAsync(int targetEmpId, int callerSpaceId, string callerRole);
        Task<IEnumerable<User>> SearchUsersAsync(string query, int empId, int callerSpaceId, string callerRole);
        Task<int> CreateUserAsync(User user, int callerSpaceId, string callerRole);
        Task<bool> UpdateUserAsync(User user, int callerEmpId, int callerSpaceId, string callerRole);
        Task<bool> DeleteUserAsync(int targetEmpId, int callerSpaceId, string callerRole);
        Task<bool> UpdateUserStatusAsync(int targetEmpId, string status, string reason, int callerEmpId, int callerSpaceId, string callerRole);
        Task<int> AddWarningAsync(EmployeeWarning warning, int callerEmpId, int callerSpaceId, string callerRole);
        Task<IEnumerable<EmployeeWarning>> GetWarningsByUserIdAsync(int targetEmpId, int callerSpaceId, string callerRole);
        Task<IEnumerable<User>> GetUsersBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<bool> UpdateBackupEmailAsync(int empId, string backupEmail);
        Task<bool> ChangePasswordAsync(int empId, string oldPassword, string newPassword);
    }

    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepo;
        private readonly ISpaceRepository _spaceRepo;

        public UserService(IUserRepository userRepo, ISpaceRepository spaceRepo)
        {
            _userRepo = userRepo;
            _spaceRepo = spaceRepo;
        }

        private async Task ValidateAccessAsync(int targetEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole == "SuperAdmin") return;

            var target = await _userRepo.GetUserByIdAsync(targetEmpId);
            if (target == null) return;

            if (callerRole == "Admin")
            {
                if (targetEmpId == callerSpaceId) return;
                var isUnder = await _userRepo.IsUserUnderAdminAsync(targetEmpId, callerSpaceId);
                if (!isUnder)
                {
                    throw new UnauthorizedAccessException("Employee does not belong to your department scope.");
                }
                return;
            }

            if (target.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Employee does not belong to your department scope.");
            }
        }

        public async Task<IEnumerable<User>> GetUsersByCompanyAsync(int empId, int callerSpaceId, string callerRole)
        {
            // Managers and TLs see users scoped to company / their spaces
            return await _userRepo.GetUsersByCompanyAsync(empId);
        }

        public async Task<User?> GetUserByIdAsync(int targetEmpId, int callerSpaceId, string callerRole)
        {
            await ValidateAccessAsync(targetEmpId, callerSpaceId, callerRole);
            return await _userRepo.GetUserByIdAsync(targetEmpId);
        }

        public async Task<IEnumerable<User>> SearchUsersAsync(string query, int empId, int callerSpaceId, string callerRole)
        {
            var companyUsers = await _userRepo.GetUsersByCompanyAsync(empId);
            var searchLower = (query ?? "").Trim().ToLower();
            if (string.IsNullOrEmpty(searchLower))
            {
                return companyUsers;
            }
            return companyUsers.Where(u =>
                (u.Email?.ToLower().Contains(searchLower) == true) ||
                (u.Role?.ToLower().Contains(searchLower) == true) ||
                (u.Name?.ToLower().Contains(searchLower) == true)
            );
        }

        public async Task<int> CreateUserAsync(User user, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                throw new UnauthorizedAccessException("Only Admins can register new employees.");
            }

            if (callerRole == "Admin")
            {
                if (user.SpaceId.HasValue && user.SpaceId.Value > 0)
                {
                    var space = await _spaceRepo.GetSpaceByIdAsync(user.SpaceId.Value);
                    if (space == null || space.AdminId != callerSpaceId)
                    {
                        throw new UnauthorizedAccessException("Cannot register employees in a space outside your management scope.");
                    }
                }
                else
                {
                    throw new ArgumentException("SpaceId is required for registering an employee.");
                }
            }
            else
            {
                if (!user.SpaceId.HasValue || user.SpaceId.Value <= 0)
                {
                    user.SpaceId = callerSpaceId;
                }
            }

            return await _userRepo.CreateUserAsync(user);
        }

        public async Task<bool> UpdateUserAsync(User user, int callerEmpId, int callerSpaceId, string callerRole)
        {
            var existing = await _userRepo.GetUserByIdAsync(user.EmpId);
            if (existing == null) return false;

            // Enforce RBAC: only Admin can change roles, status, spaces or payment details
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                if (callerEmpId != user.EmpId)
                {
                    throw new UnauthorizedAccessException("You can only modify your own profile.");
                }

                // Restore protected fields
                user.Role = existing.Role;
                user.Status = existing.Status;
                user.SpaceId = existing.SpaceId;
                user.AccountNumber = existing.AccountNumber;
                user.BankName = existing.BankName;
                user.AccountHolderName = existing.AccountHolderName;
                user.IfscCode = existing.IfscCode;
                user.UpiId = existing.UpiId;
            }
            else
            {
                // Admin can modify bank details and roles, but ensure they remain in the same Space scope
                if (callerRole != "SuperAdmin")
                {
                    if (existing.EmpId != callerSpaceId)
                    {
                        var isUnder = await _userRepo.IsUserUnderAdminAsync(existing.EmpId, callerSpaceId);
                        if (!isUnder)
                        {
                            throw new UnauthorizedAccessException("Cannot modify employees outside your space scope.");
                        }
                    }

                    if (user.SpaceId.HasValue && user.SpaceId.Value != existing.SpaceId)
                    {
                        var space = await _spaceRepo.GetSpaceByIdAsync(user.SpaceId.Value);
                        if (space == null || space.AdminId != callerSpaceId)
                        {
                            throw new UnauthorizedAccessException("Cannot move employee to a space outside your management scope.");
                        }
                    }
                }
            }

            return await _userRepo.UpdateUserAsync(user);
        }

        public async Task<bool> DeleteUserAsync(int targetEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                throw new UnauthorizedAccessException("Only Admins can remove employees.");
            }

            await ValidateAccessAsync(targetEmpId, callerSpaceId, callerRole);
            return await _userRepo.DeleteUserAsync(targetEmpId);
        }

        public async Task<bool> UpdateUserStatusAsync(int targetEmpId, string status, string reason, int callerEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager")
            {
                throw new UnauthorizedAccessException("Only Admins or Managers can change employee statuses.");
            }

            await ValidateAccessAsync(targetEmpId, callerSpaceId, callerRole);

            var result = await _userRepo.UpdateUserStatusAsync(targetEmpId, status);
            if (result && status.Trim().Equals("Inactive", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(reason))
            {
                await _userRepo.AddWarningAsync(new EmployeeWarning
                {
                    EmpId = targetEmpId,
                    WarningText = $"Account deactivated. Reason: {reason}",
                    PenaltyAmount = 0,
                    IssuedBy = callerEmpId
                });
            }

            return result;
        }

        public async Task<int> AddWarningAsync(EmployeeWarning warning, int callerEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager")
            {
                throw new UnauthorizedAccessException("Only Admins or Managers can issue disciplinary warnings.");
            }

            await ValidateAccessAsync(warning.EmpId ?? 0, callerSpaceId, callerRole);
            warning.IssuedBy = callerEmpId;
            return await _userRepo.AddWarningAsync(warning);
        }

        public async Task<IEnumerable<EmployeeWarning>> GetWarningsByUserIdAsync(int targetEmpId, int callerSpaceId, string callerRole)
        {
            await ValidateAccessAsync(targetEmpId, callerSpaceId, callerRole);
            return await _userRepo.GetWarningsByUserIdAsync(targetEmpId);
        }

        public async Task<IEnumerable<User>> GetUsersBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "SuperAdmin" && spaceId != callerSpaceId)
            {
                if (callerRole == "Admin")
                {
                    var space = await _spaceRepo.GetSpaceByIdAsync(spaceId);
                    if (space == null || space.AdminId != callerSpaceId)
                    {
                        throw new UnauthorizedAccessException("Access denied to requested space.");
                    }
                }
                else
                {
                    throw new UnauthorizedAccessException("Access denied to requested space.");
                }
            }
            return await _userRepo.GetUsersBySpaceIdAsync(spaceId);
        }

        public async Task<bool> UpdateBackupEmailAsync(int empId, string backupEmail)
        {
            return await _userRepo.UpdateBackupEmailAsync(empId, backupEmail);
        }

        public async Task<bool> ChangePasswordAsync(int empId, string oldPassword, string newPassword)
        {
            var user = await _userRepo.GetUserByIdAsync(empId);
            if (user == null) return false;

            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            var verifyResult = hasher.VerifyHashedPassword(user, user.PasswordHash ?? "", oldPassword);
            if (verifyResult == Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed)
            {
                if ((user.PasswordHash ?? "").Trim() != oldPassword.Trim())
                    return false;
            }

            string hashedNew = hasher.HashPassword(user, newPassword);
            return await _userRepo.UpdatePasswordHashAsync(empId, hashedNew);
        }
    }
}
