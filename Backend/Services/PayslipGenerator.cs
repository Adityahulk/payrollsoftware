namespace Backend.Services
{
    using System;
    using System.Data;
    using System.Linq;
    using System.Threading.Tasks;
    using Backend.Models;
    using Dapper;

    public interface IPayslipGenerator
    {
        Task<int> GeneratePayslipAsync(
            int empId,
            int spaceId,
            SalaryResponse salaryResponse,
            string paymentMethod,
            string? transactionId,
            string? accountNumber,
            string? bankName,
            string? accountHolderName,
            string? ifscCode,
            string? upiId,
            Guid? groupId,
            IDbTransaction? transaction = null,
            int month = 0,
            int year = 0);
    }

    public class PayslipGenerator : IPayslipGenerator
    {
        private readonly IDbConnection _db;
        private readonly IBonusTaskService _bonusTaskService;

        public PayslipGenerator(IDbConnection db, IBonusTaskService bonusTaskService)
        {
            _db = db;
            _bonusTaskService = bonusTaskService;
        }

        public async Task<int> GeneratePayslipAsync(
            int empId,
            int spaceId,
            SalaryResponse salaryResponse,
            string paymentMethod,
            string? transactionId,
            string? accountNumber,
            string? bankName,
            string? accountHolderName,
            string? ifscCode,
            string? upiId,
            Guid? groupId,
            IDbTransaction? transaction = null,
            int month = 0,
            int year = 0)
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;
            var basicVal = salaryResponse.Basic;
            var totalAllowances = salaryResponse.Allowances.Sum(a => a.Amount);
            var totalDeductions = salaryResponse.Deductions.Sum(d => d.Amount);

            var allowancesList = salaryResponse.Allowances.Select(a => new { name = a.Name, type = a.Type, value = a.Value, amount = a.Amount }).ToList();
            var deductionsList = salaryResponse.Deductions.Where(d => d.DeductionType == "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount }).ToList();
            var penaltiesList = salaryResponse.Deductions.Where(d => d.DeductionType != "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount, deductionType = d.DeductionType }).ToList();

            var breakdownObj = new
            {
                basic = basicVal,
                hra = salaryResponse.Hra,
                da = salaryResponse.Da,
                allowances = allowancesList,
                deductions = deductionsList,
                penalties = penaltiesList,
                finalAmount = salaryResponse.Net
            };

            string breakdownJson = System.Text.Json.JsonSerializer.Serialize(breakdownObj);

            IDbTransaction? localTransaction = null;
            bool isSelfManaged = false;

            if (transaction == null)
            {
                if (_db.State == ConnectionState.Closed)
                {
                    _db.Open();
                }
                localTransaction = _db.BeginTransaction();
                transaction = localTransaction;
                isSelfManaged = true;
            }

            try
            {
                var insertPaymentSql = @"
                    INSERT INTO t_payrollpayments 
                        (empid, spaceid, totalamount, deduction, finalamount, status, paidat, createdat, ismanual, allowanceamount, deductionamount, paymentmethod, transactionid, groupid)
                    VALUES 
                        (@EmpId, @SpaceId, @TotalAmount, @Deduction, @FinalAmount, 'Paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE, @AllowanceAmount, @DeductionAmount, @PaymentMethod, @TransactionId, @GroupId)
                    RETURNING paymentid;";

                var paymentId = await _db.ExecuteScalarAsync<int>(insertPaymentSql, new
                {
                    EmpId = empId,
                    SpaceId = spaceId,
                    TotalAmount = basicVal + salaryResponse.Hra + salaryResponse.Da,
                    Deduction = totalDeductions,
                    FinalAmount = salaryResponse.Net,
                    AllowanceAmount = totalAllowances,
                    DeductionAmount = totalDeductions,
                    PaymentMethod = paymentMethod,
                    TransactionId = transactionId,
                    GroupId = groupId == Guid.Empty ? (Guid?)null : groupId
                }, transaction);

                var insertPayslipSql = @"
                    INSERT INTO t_payslips 
                        (empid, spaceid, baseamount, deduction, finalamount, type, paymentid, generatedat, month, year, basic, totalallowance, totaldeduction, breakdown, paymentmethod, transactionid, accountnumber, bankname, accountholdername, ifsccode, upiid)
                    VALUES 
                        (@EmpId, @SpaceId, @BaseAmount, @Deduction, @FinalAmount, 'Payroll', @PaymentId, CURRENT_TIMESTAMP, @Month, @Year, @Basic, @TotalAllowance, @Deduction, @Breakdown, @PaymentMethod, @TransactionId, @AccountNumber, @BankName, @AccountHolderName, @IfscCode, @UpiId);";

                await _db.ExecuteAsync(insertPayslipSql, new
                {
                    EmpId = empId,
                    SpaceId = spaceId,
                    BaseAmount = basicVal + salaryResponse.Hra + salaryResponse.Da,
                    Deduction = totalDeductions,
                    FinalAmount = salaryResponse.Net,
                    PaymentId = paymentId,
                    Month = month,
                    Year = year,
                    Basic = basicVal,
                    TotalAllowance = totalAllowances,
                    Breakdown = breakdownJson,
                    PaymentMethod = paymentMethod,
                    TransactionId = transactionId,
                    AccountNumber = accountNumber,
                    BankName = bankName,
                    AccountHolderName = accountHolderName,
                    IfscCode = ifscCode,
                    UpiId = upiId
                }, transaction);

                // Mark task bonuses as paid
                await _bonusTaskService.MarkBonusTasksAsPaidAsync(empId, transaction);

                if (isSelfManaged && localTransaction != null)
                {
                    localTransaction.Commit();
                }

                return paymentId;
            }
            catch (Exception)
            {
                if (isSelfManaged && localTransaction != null)
                {
                    localTransaction.Rollback();
                }
                throw;
            }
            finally
            {
                if (isSelfManaged && localTransaction != null)
                {
                    localTransaction.Dispose();
                }
            }
        }
    }
}
