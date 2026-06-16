using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

namespace Backend.Services
{
    public interface ISpaceService
    {
        Task<IEnumerable<Space>> GetAllSpacesAsync(int callerSpaceId, string callerRole);
        Task<Space?> GetSpaceByIdAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<int> CreateSpaceAsync(Space space, string callerRole);
        Task<bool> UpdateSpaceAsync(Space space, int callerSpaceId, string callerRole);
        Task<bool> DeleteSpaceAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<IEnumerable<Space>> GetSpacesByAdminIdAsync(int adminId, int callerSpaceId, string callerRole);
        Task<IEnumerable<Space>> GetContractsByAdminIdAsync(int adminId, int callerSpaceId, string callerRole);
        Task<IEnumerable<Space>> GetDepartmentsByAdminIdAsync(int adminId, int callerSpaceId, string callerRole);
        
        // Allowances & Deductions
        Task<IEnumerable<Allowance>> GetAllowancesBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<int> CreateAllowanceAsync(Allowance allowance, int callerSpaceId, string callerRole);
        Task<bool> DeleteAllowanceAsync(int allowanceId, int callerSpaceId, string callerRole);
        Task<IEnumerable<Deduction>> GetDeductionsBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<int> CreateDeductionAsync(Deduction deduction, int callerSpaceId, string callerRole);
        Task<bool> DeleteDeductionAsync(int deductionId, int callerSpaceId, string callerRole);

        // Contract System
        Task<ContractPayment?> GetPaymentBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<int> CreatePaymentAsync(ContractPayment payment, int callerSpaceId, string callerRole);
        Task<bool> UpdatePaymentStatusAsync(int spaceId, string status, string? transactionId, string method, int callerSpaceId, string callerRole);
        Task<bool> GeneratePayslipsAsync(int spaceId, int paymentId, decimal amount, int callerSpaceId, string callerRole);
        Task<IEnumerable<dynamic>> GetPayslipsBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole);

        // Payroll Evaluation & Config
        Task<dynamic> GetSpacePayrollSummaryAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<IEnumerable<dynamic>> GetSpaceEmployeePayrollEvaluationsAsync(int spaceId, int? month, int? year, int callerSpaceId, string callerRole);
        Task<bool> UpdateEmployeeBasicSalaryAsync(int empId, int spaceId, decimal basic, int callerSpaceId, string callerRole);
    }

    public class SpaceService : ISpaceService
    {
        private readonly ISpaceRepository _spaceRepo;
        private readonly IUserRepository _userRepo;

        public SpaceService(ISpaceRepository spaceRepo, IUserRepository userRepo)
        {
            _spaceRepo = spaceRepo;
            _userRepo = userRepo;
        }

        private async Task ValidateSpaceScopeAsync(int targetSpaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole == "SuperAdmin") return;

            if (callerRole == "Admin")
            {
                var space = await _spaceRepo.GetSpaceByIdAsync(targetSpaceId);
                if (space == null || space.AdminId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("You do not have administrative access to this space.");
                }
                return;
            }

            if (targetSpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot access details of another department/space.");
            }
        }

        public async Task<IEnumerable<Space>> GetAllSpacesAsync(int callerSpaceId, string callerRole)
        {
            if (callerRole == "SuperAdmin")
            {
                return await _spaceRepo.GetAllSpacesAsync();
            }
            throw new UnauthorizedAccessException("Only SuperAdmin can view all spaces.");
        }

        public async Task<Space?> GetSpaceByIdAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GetSpaceByIdAsync(spaceId);
        }

        public async Task<int> CreateSpaceAsync(Space space, string callerRole)
        {
            if (callerRole != "SuperAdmin" && callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Only Admins and SuperAdmins can create spaces.");
            }
            return await _spaceRepo.CreateSpaceAsync(space);
        }

        public async Task<bool> UpdateSpaceAsync(Space space, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                throw new UnauthorizedAccessException("Only Admins can update spaces.");
            }
            await ValidateSpaceScopeAsync(space.SpaceId, callerSpaceId, callerRole);
            return await _spaceRepo.UpdateSpaceAsync(space);
        }

        public async Task<bool> DeleteSpaceAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                throw new UnauthorizedAccessException("Only Admins can delete spaces.");
            }
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.DeleteSpaceAsync(spaceId);
        }

        public async Task<IEnumerable<Space>> GetSpacesByAdminIdAsync(int adminId, int callerSpaceId, string callerRole)
        {
            // Self-healing legacy alignment checks
            var adminUser = await _userRepo.GetUserByIdAsync(adminId);
            if (adminUser != null)
            {
                int? adminSpaceId = adminUser.SpaceId;
                if (adminSpaceId.HasValue && adminSpaceId.Value > 0)
                {
                    var spaceExists = await _spaceRepo.GetSpaceByIdAsync(adminSpaceId.Value);
                    if (spaceExists == null)
                    {
                        try
                        {
                            var space = new Space
                            {
                                SpaceId = adminSpaceId.Value,
                                SpaceName = $"Workspace {adminSpaceId.Value}",
                                AdminId = adminId,
                                NumberOfEmployees = 100,
                                CreatedAt = DateTime.UtcNow,
                                IsActive = true,
                                Type = "Department",
                                WorkingDays = "[\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\"]"
                            };
                            await _spaceRepo.CreateSpaceAsync(space);
                        }
                        catch (Exception ex)
                        {
                            System.Console.WriteLine($"[Resiliency Fix Error] Failed to auto-create space: {ex.Message}");
                        }
                    }
                    else if (spaceExists.AdminId != adminId)
                    {
                        try
                        {
                            spaceExists.AdminId = adminId;
                            await _spaceRepo.UpdateSpaceAsync(spaceExists);
                        }
                        catch (Exception ex)
                        {
                            System.Console.WriteLine($"[Resiliency Fix Error] Failed to update space owner: {ex.Message}");
                        }
                    }
                }
                else
                {
                    var adminSpaces = await _spaceRepo.GetSpacesByAdminIdAsync(adminId);
                    if (!adminSpaces.Any())
                    {
                        try
                        {
                            var newSpaceName = (adminUser.Email ?? "admin").Split('@')[0] + "'s Space";
                            var space = new Space
                            {
                                SpaceName = newSpaceName,
                                AdminId = adminId,
                                NumberOfEmployees = 100,
                                CreatedAt = DateTime.UtcNow,
                                IsActive = true,
                                Type = "Department",
                                WorkingDays = "[\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\"]"
                            };
                            int newSpaceId = await _spaceRepo.CreateSpaceAsync(space);
                            await _userRepo.UpdateUserSpaceIdAsync(adminId, newSpaceId);
                        }
                        catch (Exception ex)
                        {
                            System.Console.WriteLine($"[Resiliency Fix Error] Failed to create new default space: {ex.Message}");
                        }
                    }
                }
            }

            return await _spaceRepo.GetSpacesByAdminIdAsync(adminId);
        }

        public async Task<IEnumerable<Space>> GetContractsByAdminIdAsync(int adminId, int callerSpaceId, string callerRole)
        {
            // Sync check & updates contract status
            var activeSpaces = await _spaceRepo.GetSpacesByAdminIdAsync(adminId);
            foreach (var space in activeSpaces)
            {
                if (space.Type == "Contract")
                {
                    await _spaceRepo.CheckAndUpdateContractExpiryAsync(space.SpaceId);
                }
            }
            return await _spaceRepo.GetContractsByAdminIdAsync(adminId);
        }

        public async Task<IEnumerable<Space>> GetDepartmentsByAdminIdAsync(int adminId, int callerSpaceId, string callerRole)
        {
            return await _spaceRepo.GetDepartmentsByAdminIdAsync(adminId);
        }

        public async Task<IEnumerable<Allowance>> GetAllowancesBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GetAllowancesBySpaceIdAsync(spaceId);
        }

        public async Task<int> CreateAllowanceAsync(Allowance allowance, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Only Admins can modify allowances.");
            }
            await ValidateSpaceScopeAsync(allowance.SpaceId, callerSpaceId, callerRole);
            return await _spaceRepo.CreateAllowanceAsync(allowance);
        }

        public async Task<bool> DeleteAllowanceAsync(int allowanceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Only Admins can delete allowances.");
            }
            return await _spaceRepo.DeleteAllowanceAsync(allowanceId);
        }

        public async Task<IEnumerable<Deduction>> GetDeductionsBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GetDeductionsBySpaceIdAsync(spaceId);
        }

        public async Task<int> CreateDeductionAsync(Deduction deduction, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Only Admins can modify deductions.");
            }
            await ValidateSpaceScopeAsync(deduction.SpaceId, callerSpaceId, callerRole);
            return await _spaceRepo.CreateDeductionAsync(deduction);
        }

        public async Task<bool> DeleteDeductionAsync(int deductionId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Only Admins can delete deductions.");
            }
            return await _spaceRepo.DeleteDeductionAsync(deductionId);
        }

        public async Task<ContractPayment?> GetPaymentBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GetPaymentBySpaceIdAsync(spaceId);
        }

        public async Task<int> CreatePaymentAsync(ContractPayment payment, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }
            await ValidateSpaceScopeAsync(payment.SpaceId, callerSpaceId, callerRole);
            return await _spaceRepo.CreatePaymentAsync(payment);
        }

        public async Task<bool> UpdatePaymentStatusAsync(int spaceId, string status, string? transactionId, string method, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.UpdatePaymentStatusAsync(spaceId, status, transactionId, method);
        }

        public async Task<bool> GeneratePayslipsAsync(int spaceId, int paymentId, decimal amount, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GeneratePayslipsAsync(spaceId, paymentId, amount);
        }

        public async Task<IEnumerable<dynamic>> GetPayslipsBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GetPayslipsBySpaceIdAsync(spaceId);
        }

        public async Task<dynamic> GetSpacePayrollSummaryAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GetSpacePayrollSummaryAsync(spaceId);
        }

        public async Task<IEnumerable<dynamic>> GetSpaceEmployeePayrollEvaluationsAsync(int spaceId, int? month, int? year, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.GetSpaceEmployeePayrollEvaluationsAsync(spaceId, true, month, year);
        }

        public async Task<bool> UpdateEmployeeBasicSalaryAsync(int empId, int spaceId, decimal basic, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin")
            {
                throw new UnauthorizedAccessException("Only Admins can modify basic salaries.");
            }
            if (basic < 0)
            {
                throw new ArgumentException("Salary cannot be negative.");
            }
            await ValidateSpaceScopeAsync(spaceId, callerSpaceId, callerRole);
            return await _spaceRepo.UpdateEmployeeBasicSalaryAsync(empId, spaceId, basic);
        }
    }
}
