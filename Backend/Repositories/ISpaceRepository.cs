namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface ISpaceRepository
{
    Task<IEnumerable<Space>> GetAllSpacesAsync();
    Task<Space?> GetSpaceByIdAsync(int spaceId);
    Task<int> CreateSpaceAsync(Space space);
    Task<bool> UpdateSpaceAsync(Space space);
    Task<bool> DeleteSpaceAsync(int spaceId);
    Task<IEnumerable<Space>> GetSpacesByAdminIdAsync(int adminId);
    Task<bool> SoftDeleteSpaceAsync(int spaceId);

    // Contract Management System
    Task<IEnumerable<Space>> GetContractsByAdminIdAsync(int adminId);
    Task<IEnumerable<Space>> GetDepartmentsByAdminIdAsync(int adminId);
    Task<ContractPayment?> GetPaymentBySpaceIdAsync(int spaceId);
    Task<int> CreatePaymentAsync(ContractPayment payment);
    Task<bool> UpdatePaymentStatusAsync(int spaceId, string status, string? transactionId, string method);
    Task<bool> GeneratePayslipsAsync(int spaceId, int paymentId, decimal amount);
    Task<IEnumerable<dynamic>> GetPayslipsBySpaceIdAsync(int spaceId);
    Task<bool> CheckAndUpdateContractExpiryAsync(int spaceId);

    // Performance-Based Payroll System
    Task<dynamic> GetSpacePayrollSummaryAsync(int spaceId);
    Task<IEnumerable<dynamic>> GetSpaceEmployeePayrollEvaluationsAsync(int spaceId, bool applyPenalties = true, int? month = null, int? year = null);
    Task<int> CreatePayrollPaymentAsync(PayrollPayment payment);
    Task<bool> UpdatePayrollPaymentStatusAsync(int empid, int spaceId, string status);
    Task<bool> GeneratePayrollPayslipAsync(Payslip payslip);
    Task<bool> ResetSpacePayrollPaymentsAsync(int spaceId);

    // Salary & Financial Configurations
    Task<bool> UpdateEmployeeBasicSalaryAsync(int empId, int spaceId, decimal basic);
    Task<decimal> GetEmployeeBasicSalaryAsync(int empId);
    Task<IEnumerable<Allowance>> GetAllowancesBySpaceIdAsync(int spaceId);
    Task<int> CreateAllowanceAsync(Allowance allowance);
    Task<bool> DeleteAllowanceAsync(int allowanceId);
    Task<IEnumerable<Deduction>> GetDeductionsBySpaceIdAsync(int spaceId);
    Task<int> CreateDeductionAsync(Deduction deduction);
    Task<bool> DeleteDeductionAsync(int deductionId);
}

