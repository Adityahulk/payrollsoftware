using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

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
        Task<(int successCount, Guid groupId)> PaySpacePayrollAsync(int spaceId, PayrollPayoutRequest request, int callerSpaceId, string callerRole);
        Task<(int successCount, Guid groupId)> ConfirmPayrollPaymentAsync(int spaceId, ConfirmPaymentRequest request, int callerSpaceId, string callerRole);
        Task<bool> ResetSpacePayrollAsync(int spaceId, int callerSpaceId, string callerRole);
    }
}
