namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface ISalaryRepository
{
    Task<SalaryResponse?> GetSalaryAsync(int empId, int month, int year);
    Task<ProgressReport> GetProgressReportAsync(int empId);
    Task EnsureSalaryTableAsync();
    Task EnsureWorklogTableAsync();
    Task<IEnumerable<PayrollPayment>> GetPaymentHistoryAsync(int empId, int limit = 12);
    Task<CtcSummaryResponse> GetCtcSummaryAsync(int empId, int year);
    Task<IEnumerable<Payslip>> GetMyPayslipsAsync(int empId, int limit = 24);
    Task<IEnumerable<User>> GetCompanyUsersForPayrollAsync(int adminId);
    Task<bool> CheckIfAlreadyPaidAsync(int empId, int month, int year);
    Task<int> CreatePayrollPaymentDirectAsync(int empId, int spaceId, decimal totalAmount, decimal deduction, decimal finalAmount, decimal allowanceAmount, string paymentMethod, string transactionId);
    Task CreatePayslipDirectAsync(int empId, int spaceId, decimal baseAmount, decimal deduction, decimal finalAmount, int paymentId, decimal basic, decimal totalAllowance, string breakdown, string paymentMethod, string transactionId, int month = 0, int year = 0);
}
