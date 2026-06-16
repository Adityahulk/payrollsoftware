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
    public interface ISalaryService
    {
        Task<SalaryResponse?> GetSalaryAsync(int empId, int month, int year, int callerSpaceId, string callerRole);
        Task<ProgressReport> GetProgressReportAsync(int empId, int callerSpaceId, string callerRole);
        Task<IEnumerable<PayrollPayment>> GetPaymentHistoryAsync(int empId, int limit, int callerSpaceId, string callerRole);
        Task<CtcSummaryResponse> GetCtcSummaryAsync(int empId, int year, int callerSpaceId, string callerRole);
        Task<IEnumerable<Payslip>> GetMyPayslipsAsync(int empId, int limit, int callerSpaceId, string callerRole);
        Task<int> ProcessMonthPayrollAsync(int adminEmpId, int month, int year);

        // Bulk operations moved from SpaceController
        Task<(int successCount, Guid groupId)> PaySpacePayrollAsync(int spaceId, PayrollPayoutRequest request, int callerSpaceId, string callerRole);
        Task<(int successCount, Guid groupId)> ConfirmPayrollPaymentAsync(int spaceId, ConfirmPaymentRequest request, int callerSpaceId, string callerRole);
        Task<bool> ResetSpacePayrollAsync(int spaceId, int callerSpaceId, string callerRole);
    }

    public class SalaryService : ISalaryService
    {
        private readonly ISalaryRepository _salaryRepo;
        private readonly IUserRepository _userRepo;
        private readonly ISpaceRepository _spaceRepo;
        private readonly IDbConnection _db;
        private readonly IBonusTaskService _bonusTaskService;

        public SalaryService(
            ISalaryRepository salaryRepo, 
            IUserRepository userRepo, 
            ISpaceRepository spaceRepo,
            IDbConnection db, 
            IBonusTaskService bonusTaskService)
        {
            _salaryRepo = salaryRepo;
            _userRepo = userRepo;
            _spaceRepo = spaceRepo;
            _db = db;
            _bonusTaskService = bonusTaskService;
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
            var salaryResponse = await _salaryRepo.GetSalaryAsync(empId, month, year);
            if (salaryResponse == null) return null;

            // Load unpaid bonus tasks and include in payroll calculations
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
                salaryResponse.Net += unpaidBonus;
            }

            // Rebuild payroll logic fully on the backend: Net = Basic + Allowances - Deductions
            decimal totalAllowances = salaryResponse.Allowances.Sum(a => a.Amount);
            decimal totalDeductions = salaryResponse.Deductions.Sum(d => d.Amount);
            decimal backendCalculatedNet = Math.Max(0m, salaryResponse.Basic + totalAllowances - totalDeductions);

            salaryResponse.Net = backendCalculatedNet;
            return salaryResponse;
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
                // Employees can check their own payment history
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
                var salaryResponse = await _salaryRepo.GetSalaryAsync(user.EmpId, month, year);
                if (salaryResponse == null) continue;

                bool alreadyPaid = await _salaryRepo.CheckIfAlreadyPaidAsync(user.EmpId, month, year);
                if (alreadyPaid) continue;

                // Load unpaid bonus tasks and include in payroll calculations
                var unpaidBonus = await _bonusTaskService.GetUnpaidBonusAmountAsync(user.EmpId);
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
                    salaryResponse.Net += unpaidBonus;
                }

                // Rebuild payroll logic fully on the backend: Net = Basic + Allowances - Deductions
                decimal totalAllowances = salaryResponse.Allowances.Sum(a => a.Amount);
                decimal totalDeductions = salaryResponse.Deductions.Sum(d => d.Amount);
                decimal backendCalculatedNet = Math.Max(0m, salaryResponse.Basic + totalAllowances - totalDeductions);

                var allowancesList = salaryResponse.Allowances.Select(a => new { name = a.Name, type = a.Type, value = a.Value, amount = a.Amount }).ToList();
                var deductionsList = salaryResponse.Deductions.Where(d => d.DeductionType == "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount }).ToList();
                var penaltiesList = salaryResponse.Deductions.Where(d => d.DeductionType != "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount, deductionType = d.DeductionType }).ToList();

                var breakdownObj = new
                {
                    basic = salaryResponse.Basic,
                    hra = salaryResponse.Hra,
                    da = salaryResponse.Da,
                    allowances = allowancesList,
                    deductions = deductionsList,
                    penalties = penaltiesList,
                    finalAmount = backendCalculatedNet
                };

                string breakdownJson = System.Text.Json.JsonSerializer.Serialize(breakdownObj);
                string transactionId = $"TXN_{year}_{month}_{user.EmpId}";

                // Enforce transaction protection using IDbTransaction
                using (var transaction = _db.BeginTransaction())
                {
                    try
                    {
                        var insertPaymentSql = @"
                            INSERT INTO t_payrollpayments 
                                (empid, spaceid, totalamount, deduction, finalamount, status, paidat, createdat, ismanual, allowanceamount, deductionamount, paymentmethod, transactionid)
                            VALUES 
                                (@EmpId, @SpaceId, @TotalAmount, @Deduction, @FinalAmount, 'Paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE, @AllowanceAmount, @DeductionAmount, @PaymentMethod, @TransactionId)
                            RETURNING paymentid;";

                        var paymentId = await _db.ExecuteScalarAsync<int>(insertPaymentSql, new
                        {
                            EmpId = user.EmpId,
                            SpaceId = user.SpaceId ?? 0,
                            TotalAmount = salaryResponse.Basic + salaryResponse.Hra + salaryResponse.Da,
                            Deduction = totalDeductions,
                            FinalAmount = backendCalculatedNet,
                            AllowanceAmount = totalAllowances,
                            DeductionAmount = totalDeductions,
                            PaymentMethod = "Direct Transfer",
                            TransactionId = transactionId
                        }, transaction);

                        var insertPayslipSql = @"
                            INSERT INTO t_payslips 
                                (empid, spaceid, baseamount, deduction, finalamount, type, paymentid, generatedat, basic, totalallowance, totaldeduction, breakdown, paymentmethod, transactionid)
                            VALUES 
                                (@EmpId, @SpaceId, @BaseAmount, @Deduction, @FinalAmount, 'Payroll', @PaymentId, CURRENT_TIMESTAMP, @Basic, @TotalAllowance, @Deduction, @Breakdown, @PaymentMethod, @TransactionId);";

                        await _db.ExecuteAsync(insertPayslipSql, new
                        {
                            EmpId = user.EmpId,
                            SpaceId = user.SpaceId ?? 0,
                            BaseAmount = salaryResponse.Basic + salaryResponse.Hra + salaryResponse.Da,
                            Deduction = totalDeductions,
                            FinalAmount = backendCalculatedNet,
                            PaymentId = paymentId,
                            Basic = salaryResponse.Basic,
                            TotalAllowance = totalAllowances,
                            Breakdown = breakdownJson,
                            PaymentMethod = "Direct Transfer",
                            TransactionId = transactionId
                        }, transaction);

                        // Mark work intensity bonus tasks as paid
                        await _bonusTaskService.MarkBonusTasksAsPaidAsync(user.EmpId, transaction);

                        transaction.Commit();
                        successCount++;
                    }
                    catch (Exception)
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
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
            Guid? groupIdVal)
        {
            var evaluations = await _spaceRepo.GetSpaceEmployeePayrollEvaluationsAsync(spaceId);
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

                // Retrieve live salary evaluations directly from backend as source of truth
                var salaryResponse = await _salaryRepo.GetSalaryAsync(item.EmpId, DateTime.UtcNow.Month, DateTime.UtcNow.Year);
                if (salaryResponse == null)
                {
                    throw new Exception($"Failed to evaluate salary structure for employee #{item.EmpId}.");
                }

                // Include Work Intensity Bonus
                var unpaidBonus = await _bonusTaskService.GetUnpaidBonusAmountAsync(item.EmpId);
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
                    salaryResponse.Net += unpaidBonus;
                }

                var basicVal = salaryResponse.Basic;
                
                var allowancesList = salaryResponse.Allowances.Select(a => new { name = a.Name, type = a.Type, value = a.Value, amount = a.Amount }).ToList();
                var deductionsList = salaryResponse.Deductions.Where(d => d.DeductionType == "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount }).ToList();
                var penaltiesList = salaryResponse.Deductions.Where(d => d.DeductionType != "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount, deductionType = d.DeductionType }).ToList();

                var finalAmountToPay = item.IsManual ? item.FinalAmount : salaryResponse.Net;

                var breakdownObj = new
                {
                    basic = basicVal,
                    hra = salaryResponse.Hra,
                    da = salaryResponse.Da,
                    allowances = allowancesList,
                    deductions = deductionsList,
                    penalties = penaltiesList,
                    finalAmount = finalAmountToPay
                };

                string breakdownJson = System.Text.Json.JsonSerializer.Serialize(breakdownObj);

                var payrollPayment = new PayrollPayment
                {
                    EmpId = item.EmpId,
                    SpaceId = spaceId,
                    TotalAmount = basicVal + salaryResponse.Hra + salaryResponse.Da,
                    Deduction = salaryResponse.Deductions.Sum(d => d.Amount),
                    FinalAmount = finalAmountToPay,
                    Status = "Paid",
                    PaidAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    IsManual = item.IsManual,
                    AllowanceAmount = salaryResponse.Allowances.Sum(a => a.Amount),
                    DeductionAmount = salaryResponse.Deductions.Sum(d => d.Amount),
                    PaymentMethod = paymentMethod,
                    TransactionId = transactionId,
                    GroupId = groupId == Guid.Empty ? null : groupId
                };

                using (var transaction = _db.BeginTransaction())
                {
                    try
                    {
                        int paymentId = await _spaceRepo.CreatePayrollPaymentAsync(payrollPayment);
                        if (paymentId > 0)
                        {
                            var slip = new Payslip
                            {
                                EmpId = item.EmpId,
                                SpaceId = spaceId,
                                BaseAmount = payrollPayment.TotalAmount,
                                Deduction = payrollPayment.Deduction,
                                FinalAmount = finalAmountToPay,
                                Type = "Payroll",
                                PaymentId = paymentId,
                                GeneratedAt = DateTime.UtcNow,
                                Basic = basicVal,
                                TotalAllowance = payrollPayment.AllowanceAmount,
                                TotalDeduction = payrollPayment.Deduction,
                                Breakdown = breakdownJson,
                                PaymentMethod = paymentMethod,
                                TransactionId = transactionId,
                                AccountNumber = eval.AccountNumber?.ToString(),
                                BankName = eval.BankName?.ToString(),
                                AccountHolderName = eval.AccountHolderName?.ToString(),
                                IfscCode = eval.IfscCode?.ToString(),
                                UpiId = eval.UpiId?.ToString()
                            };

                            await _spaceRepo.GeneratePayrollPayslipAsync(slip);
                            
                            // Mark bonus tasks as paid
                            await _bonusTaskService.MarkBonusTasksAsPaidAsync(item.EmpId, transaction);

                            transaction.Commit();
                            successCount++;
                        }
                        else
                        {
                            transaction.Rollback();
                        }
                    }
                    catch (Exception)
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
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

            return await ProcessPayoutBatchAsync(spaceId, request.Employees, paymentMethod, request.TransactionId, null);
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

            return await ProcessPayoutBatchAsync(spaceId, request.Employees, "Razorpay", request.PaymentId, null);
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
