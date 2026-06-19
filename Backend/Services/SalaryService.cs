using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;
using Dapper;

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

        public SalaryService(
            ISalaryRepository salaryRepo, 
            IUserRepository userRepo, 
            ISpaceRepository spaceRepo,
            IDbConnection db, 
            IPayrollEngine payrollEngine,
            IPayslipGenerator payslipGenerator)
        {
            _salaryRepo = salaryRepo;
            _userRepo = userRepo;
            _spaceRepo = spaceRepo;
            _db = db;
            _payrollEngine = payrollEngine;
            _payslipGenerator = payslipGenerator;
        }

        private async Task ValidateUserScopeAsync(int targetEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole == "SuperAdmin") return;

            var user = await _userRepo.GetUserByIdAsync(targetEmpId);
            if (user == null)
            {
                throw new UnauthorizedAccessException("Employee not found.");
            }

            if (callerRole == "Admin")
            {
                if (targetEmpId == callerSpaceId) return;
                var isUnder = await _userRepo.IsUserUnderAdminAsync(targetEmpId, callerSpaceId);
                if (!isUnder)
                {
                    throw new UnauthorizedAccessException("Employee is outside your space/department scope.");
                }
                return;
            }

            if (user.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Employee is outside your space/department scope.");
            }
        }

        public async Task<SalaryResponse?> GetSalaryAsync(int empId, int month, int year, int callerSpaceId, string callerRole)
        {
            await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);
            return await _payrollEngine.CalculateSalaryAsync(empId, month, year);
        }

        public async Task<ProgressReport> GetProgressReportAsync(int empId, int callerSpaceId, string callerRole)
        {
            await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);
            return await _salaryRepo.GetProgressReportAsync(empId);
        }

        public async Task<IEnumerable<PayrollPayment>> GetPaymentHistoryAsync(int empId, int limit, int callerSpaceId, string callerRole)
        {
            if (callerRole == "Employee")
            {
                var jwtUser = await _userRepo.GetUserByIdAsync(empId);
                if (jwtUser == null) throw new UnauthorizedAccessException("Employee not found.");
            }
            else
            {
                await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);
            }
            return await _salaryRepo.GetPaymentHistoryAsync(empId, limit);
        }

        public async Task<CtcSummaryResponse> GetCtcSummaryAsync(int empId, int year, int callerSpaceId, string callerRole)
        {
            if (callerRole == "Employee")
            {
                var jwtUser = await _userRepo.GetUserByIdAsync(empId);
                if (jwtUser == null) throw new UnauthorizedAccessException("Employee not found.");
            }
            else
            {
                await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);
            }
            return await _salaryRepo.GetCtcSummaryAsync(empId, year);
        }

        public async Task<IEnumerable<Payslip>> GetMyPayslipsAsync(int empId, int limit, int callerSpaceId, string callerRole)
        {
            if (callerRole == "Employee")
            {
                var jwtUser = await _userRepo.GetUserByIdAsync(empId);
                if (jwtUser == null) throw new UnauthorizedAccessException("Employee not found.");
            }
            else
            {
                await ValidateUserScopeAsync(empId, callerSpaceId, callerRole);
            }
            return await _salaryRepo.GetMyPayslipsAsync(empId, limit);
        }

        public async Task<int> ProcessMonthPayrollAsync(int adminEmpId, int month, int year)
        {
            var adminUser = await _userRepo.GetUserByIdAsync(adminEmpId);
            if (adminUser == null || adminUser.Role != "Admin")
            {
                throw new UnauthorizedAccessException("Only space administrators can trigger month-end payroll.");
            }

            var users = await _salaryRepo.GetCompanyUsersForPayrollAsync(adminEmpId);
            int successCount = 0;

            foreach (var user in users.Where(u => u.Role != "Admin" && u.Status == "Active"))
            {
                var salaryResponse = await _payrollEngine.CalculateSalaryAsync(user.EmpId, month, year);
                if (salaryResponse == null) continue;

                bool alreadyPaid = await _salaryRepo.CheckIfAlreadyPaidAsync(user.EmpId, month, year);
                if (alreadyPaid) continue;

                string transactionId = $"TXN_{year}_{month}_{user.EmpId}";

                await _payslipGenerator.GeneratePayslipAsync(
                    empId: user.EmpId,
                    spaceId: user.SpaceId ?? 0,
                    salaryResponse: salaryResponse,
                    paymentMethod: "Direct Transfer",
                    transactionId: transactionId,
                    accountNumber: user.AccountNumber,
                    bankName: user.BankName,
                    accountHolderName: user.AccountHolderName,
                    ifscCode: user.IfscCode,
                    upiId: user.UpiId,
                    groupId: null,
                    month: month,
                    year: year);

                successCount++;
            }

            return successCount;
        }

        private string? ValidatePayoutProfile(string paymentMethod, dynamic eval)
        {
            var name = eval.Name?.ToString() ?? "Employee";
            if (paymentMethod == "UPI")
            {
                var upiid = eval.UpiId?.ToString();
                if (string.IsNullOrWhiteSpace(upiid))
                {
                    return $"Employee '{name}' does not have a UPI ID configured. UPI ID is required for UPI payments.";
                }
            }
            else if (paymentMethod == "Razorpay" || paymentMethod == "Bank Transfer")
            {
                var accNum = eval.AccountNumber?.ToString();
                var bankName = eval.BankName?.ToString();
                var accHolder = eval.AccountHolderName?.ToString();
                var ifsc = eval.IfscCode?.ToString();

                if (string.IsNullOrWhiteSpace(accNum) || string.IsNullOrWhiteSpace(bankName) || string.IsNullOrWhiteSpace(accHolder) || string.IsNullOrWhiteSpace(ifsc))
                {
                    return $"Employee '{name}' is missing bank configuration details. Bank details (Account Number, Bank Name, Account Holder, and IFSC) are required for {paymentMethod} payments.";
                }
            }
            return null;
        }

        private async Task<(int successCount, Guid groupId)> ProcessPayoutBatchAsync(
            int spaceId, 
            List<EmployeePayoutItem> employees, 
            string paymentMethod, 
            string? transactionId, 
            Guid? groupIdVal,
            int month,
            int year)
        {
            var evaluations = await _spaceRepo.GetSpaceEmployeePayrollEvaluationsAsync(spaceId, true, month, year);
            var evalDict = new Dictionary<int, dynamic>();
            foreach (var ev in evaluations)
            {
                evalDict[Convert.ToInt32(ev.EmpId)] = ev;
            }

            Guid groupId = groupIdVal ?? (employees.Count > 1 ? Guid.NewGuid() : Guid.Empty);
            int successCount = 0;

            foreach (var item in employees)
            {
                if (!evalDict.TryGetValue(item.EmpId, out var eval))
                {
                    throw new Exception($"Employee with ID {item.EmpId} does not belong to this Space.");
                }

                var validationError = ValidatePayoutProfile(paymentMethod, eval);
                if (validationError != null)
                {
                    throw new Exception(validationError);
                }

                // Retrieve live calculated salary details
                var salaryResponse = await _payrollEngine.CalculateSalaryAsync(item.EmpId, month, year);
                if (salaryResponse == null)
                {
                    throw new Exception($"Failed to evaluate salary structure for employee #{item.EmpId}.");
                }

                var finalAmountToPay = item.IsManual ? item.FinalAmount : salaryResponse.Net;
                salaryResponse.Net = finalAmountToPay;

                await _payslipGenerator.GeneratePayslipAsync(
                    empId: item.EmpId,
                    spaceId: spaceId,
                    salaryResponse: salaryResponse,
                    paymentMethod: paymentMethod,
                    transactionId: transactionId,
                    accountNumber: eval.AccountNumber?.ToString(),
                    bankName: eval.BankName?.ToString(),
                    accountHolderName: eval.AccountHolderName?.ToString(),
                    ifscCode: eval.IfscCode?.ToString(),
                    upiId: eval.UpiId?.ToString(),
                    groupId: groupId == Guid.Empty ? (Guid?)null : groupId,
                    month: month,
                    year: year);

                successCount++;
            }

            return (successCount, groupId);
        }

        public async Task<(int successCount, Guid groupId)> PaySpacePayrollAsync(int spaceId, PayrollPayoutRequest request, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                throw new UnauthorizedAccessException("Only Admins can process space payroll payments.");
            }
            if (callerRole != "SuperAdmin" && spaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot pay payroll for employees outside your space scope.");
            }

            if (request == null || request.Employees == null || request.Employees.Count == 0)
            {
                throw new ArgumentException("No employees list was provided in the payment request.");
            }

            var paymentMethod = request.PaymentMethod?.Trim();
            if (paymentMethod != "Cash" && paymentMethod != "UPI" && paymentMethod != "Bank Transfer")
            {
                throw new ArgumentException("Invalid payment method. Only Cash, UPI, and Bank Transfer are supported.");
            }

            if (request.Employees.Count > 1 && paymentMethod == "UPI")
            {
                throw new ArgumentException("Direct UPI payment is NOT allowed for multiple employees (bulk payout).");
            }

            int month = request.Month ?? DateTime.UtcNow.Month;
            int year = request.Year ?? DateTime.UtcNow.Year;
            return await ProcessPayoutBatchAsync(spaceId, request.Employees, paymentMethod, request.TransactionId, null, month, year);
        }

        public async Task<(int successCount, Guid groupId)> ConfirmPayrollPaymentAsync(int spaceId, ConfirmPaymentRequest request, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                throw new UnauthorizedAccessException("Only Admins can confirm space payroll payments.");
            }
            if (callerRole != "SuperAdmin" && spaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot confirm payroll for employees outside your space scope.");
            }

            if (request == null || request.Employees == null || request.Employees.Count == 0)
            {
                throw new ArgumentException("No employees list was provided in the confirmation request.");
            }

            if (string.IsNullOrEmpty(request.OrderId) || string.IsNullOrEmpty(request.PaymentId))
            {
                throw new ArgumentException("Razorpay orderId and paymentId are required.");
            }

            int month = request.Month ?? DateTime.UtcNow.Month;
            int year = request.Year ?? DateTime.UtcNow.Year;
            return await ProcessPayoutBatchAsync(spaceId, request.Employees, "Razorpay", request.PaymentId, null, month, year);
        }

        public async Task<bool> ResetSpacePayrollAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "SuperAdmin")
            {
                throw new UnauthorizedAccessException("Only Admins can reset space payroll.");
            }
            if (callerRole != "SuperAdmin" && spaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot reset payroll for other spaces.");
            }

            return await _spaceRepo.ResetSpacePayrollPaymentsAsync(spaceId);
        }
    }
}
