// FIXED SalaryService.cs
// Clean merged version (Architecture + Bonus logic)

using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

namespace Backend.Services
{
    public class SalaryService : ISalaryService
    {
        private readonly ISalaryRepository _salaryRepo;
        private readonly IUserRepository _userRepo;
        private readonly ISpaceRepository _spaceRepo;
        private readonly IDbConnection _db;
        private readonly IPayrollEngine _payrollEngine;
        private readonly IPayslipGenerator _payslipGenerator;
        private readonly IBonusTaskService _bonusTaskService;

        public SalaryService(
            ISalaryRepository salaryRepo,
            IUserRepository userRepo,
            ISpaceRepository spaceRepo,
            IDbConnection db,
            IPayrollEngine payrollEngine,
            IPayslipGenerator payslipGenerator,
            IBonusTaskService bonusTaskService)
        {
            _salaryRepo = salaryRepo;
            _userRepo = userRepo;
            _spaceRepo = spaceRepo;
            _db = db;
            _payrollEngine = payrollEngine;
            _payslipGenerator = payslipGenerator;
            _bonusTaskService = bonusTaskService;
        }

        private async Task ValidateUserScopeAsync(int targetEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole == "SuperAdmin") return;

            var user = await _userRepo.GetUserByIdAsync(targetEmpId);
            if (user == null)
                throw new UnauthorizedAccessException("Employee not found.");

            if (callerRole == "Admin")
            {
                if (targetEmpId == callerSpaceId) return;

                var isUnder = await _userRepo.IsUserUnderAdminAsync(targetEmpId, callerSpaceId);
                if (!isUnder)
                    throw new UnauthorizedAccessException("Outside scope");

                return;
            }

            if (user.SpaceId != callerSpaceId)
                throw new UnauthorizedAccessException("Outside scope");
        }

        // ========================
        // GET SALARY (IMPORTANT)
        // ========================
        public async Task<SalaryResponse?> GetSalaryAsync(int empId, int month, int year, int callerSpaceId, string callerRole)
        {
            await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);

            var salary = await _payrollEngine.CalculateSalaryAsync(empId, month, year);
            if (salary == null) return null;

            // ✅ ADD BONUS BACK
            var bonus = await _bonusTaskService.GetUnpaidBonusAmountAsync(empId);
            if (bonus > 0)
            {
                salary.Allowances.Add(new BreakdownItem
                {
                    Name = "Work Intensity Bonus",
                    Type = "Fixed",
                    Value = bonus,
                    Amount = bonus
                });

                salary.Gross += bonus;
                salary.Net += bonus;
            }

            return salary;
        }

        public async Task<ProgressReport> GetProgressReportAsync(int empId, int callerSpaceId, string callerRole)
        {
            await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);
            return await _salaryRepo.GetProgressReportAsync(empId);
        }

        public async Task<IEnumerable<PayrollPayment>> GetPaymentHistoryAsync(int empId, int limit, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Employee")
                await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);

            return await _salaryRepo.GetPaymentHistoryAsync(empId, limit);
        }

        public async Task<CtcSummaryResponse> GetCtcSummaryAsync(int empId, int year, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Employee")
                await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);

            return await _salaryRepo.GetCtcSummaryAsync(empId, year);
        }

        public async Task<IEnumerable<Payslip>> GetMyPayslipsAsync(int empId, int limit, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Employee")
                await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);

            return await _salaryRepo.GetMyPayslipsAsync(empId, limit);
        }

        // ========================
        // MONTH PROCESS
        // ========================
        public async Task<int> ProcessMonthPayrollAsync(int adminEmpId, int month, int year)
        {
            var admin = await _userRepo.GetUserByIdAsync(adminEmpId);
            if (admin?.Role != "Admin")
                throw new UnauthorizedAccessException("Only admin allowed");

            var users = await _salaryRepo.GetCompanyUsersForPayrollAsync(adminEmpId);
            int success = 0;

            foreach (var user in users.Where(u => u.Role != "Admin" && u.Status == "Active"))
            {
                var salary = await _payrollEngine.CalculateSalaryAsync(user.EmpId, month, year);
                if (salary == null) continue;

                bool paid = await _salaryRepo.CheckIfAlreadyPaidAsync(user.EmpId, month, year);
                if (paid) continue;

                // ✅ ADD BONUS
                var bonus = await _bonusTaskService.GetUnpaidBonusAmountAsync(user.EmpId);
                if (bonus > 0)
                {
                    salary.Allowances.Add(new BreakdownItem
                    {
                        Name = "Work Intensity Bonus",
                        Type = "Fixed",
                        Value = bonus,
                        Amount = bonus
                    });

                    salary.Gross += bonus;
                    salary.Net += bonus;
                }

                await _payslipGenerator.GeneratePayslipAsync(
                    user.EmpId,
                    user.SpaceId ?? 0,
                    salary,
                    "Direct Transfer",
                    $"TXN_{year}_{month}_{user.EmpId}",
                    user.AccountNumber,
                    user.BankName,
                    user.AccountHolderName,
                    user.IfscCode,
                    user.UpiId,
                    null,
                    month,
                    year
                );

                await _bonusTaskService.MarkBonusTasksAsPaidAsync(user.EmpId, null);

                success++;
            }

            return success;
        }

        public async Task<bool> ResetSpacePayrollAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
                throw new UnauthorizedAccessException();

            return await _spaceRepo.ResetSpacePayrollPaymentsAsync(spaceId);
        }
    }
}