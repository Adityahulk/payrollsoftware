namespace Backend.Services
{
    using System;
    using System.Linq;
    using System.Threading.Tasks;
    using Backend.Models;
    using Backend.Repositories;

    public interface IPayrollEngine
    {
        Task<SalaryResponse?> CalculateSalaryAsync(int empId, int month, int year);
    }

    public class PayrollEngine : IPayrollEngine
    {
        private readonly ISalaryRepository _salaryRepo;
        private readonly IBonusTaskService _bonusTaskService;
        private readonly IIncentiveService _incentiveService;

        public PayrollEngine(
            ISalaryRepository salaryRepo,
            IBonusTaskService bonusTaskService,
            IIncentiveService incentiveService)
        {
            _salaryRepo = salaryRepo;
            _bonusTaskService = bonusTaskService;
            _incentiveService = incentiveService;
        }

        public async Task<SalaryResponse?> CalculateSalaryAsync(int empId, int month, int year)
        {
            var salaryResponse = await _salaryRepo.GetSalaryAsync(empId, month, year);
            if (salaryResponse == null) return null;

            // 1. Load unpaid bonus tasks and include in payroll calculations
            var unpaidBonus = await _bonusTaskService.GetUnpaidBonusAmountAsync(empId);
            if (unpaidBonus > 0)
            {
                salaryResponse.Allowances.Add(new BreakdownItem
                {
                    Name = "Work Intensity Bonus (Completed Tasks)",
                    Type = "Fixed",
                    Value = unpaidBonus,
                    Amount = unpaidBonus
                });
                salaryResponse.Gross += unpaidBonus;
            }

            // 2. Fetch incentives for empid, month, year and add to earnings list as "Incentive"
            var totalIncentive = await _incentiveService.GetTotalIncentiveAsync(empId, month, year);
            if (totalIncentive > 0)
            {
                salaryResponse.Allowances.Add(new BreakdownItem
                {
                    Name = "Incentive",
                    Type = "Fixed",
                    Value = totalIncentive,
                    Amount = totalIncentive
                });
                salaryResponse.Gross += totalIncentive;
            }

            // 3. Rebuild payroll logic fully on the backend: Net = Basic + Allowances - Deductions
            decimal totalAllowances = salaryResponse.Allowances.Sum(a => a.Amount);
            decimal totalDeductions = salaryResponse.Deductions.Sum(d => d.Amount);
            decimal backendCalculatedNet = Math.Max(0m, salaryResponse.Basic + totalAllowances - totalDeductions);

            salaryResponse.Net = backendCalculatedNet;

            return salaryResponse;
        }
    }
}
