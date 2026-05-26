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
}
