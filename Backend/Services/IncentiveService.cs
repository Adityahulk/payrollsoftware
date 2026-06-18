namespace Backend.Services
{
    using System;
    using System.Collections.Generic;
    using System.Data;
    using System.Threading.Tasks;
    using Backend.Models;
    using Dapper;

    public interface IIncentiveService
    {
        Task<decimal> GetTotalIncentiveAsync(int empId, int month, int year);
        Task<IEnumerable<Incentive>> GetEmployeeIncentivesAsync(int empId, int? month, int? year);
        Task<int> AddIncentiveAsync(int empId, int spaceId, int addedBy, decimal amount, string type, string reason, int month, int year);
        Task<bool> DeleteIncentiveAsync(int id);
    }

    public class IncentiveService : IIncentiveService
    {
        private readonly IDbConnection _db;

        public IncentiveService(IDbConnection db)
        {
            _db = db;
        }

        public async Task<decimal> GetTotalIncentiveAsync(int empId, int month, int year)
        {
            var sql = "SELECT COALESCE(SUM(amount), 0) FROM t_incentives WHERE empid = @EmpId AND month = @Month AND year = @Year";
            return await _db.ExecuteScalarAsync<decimal>(sql, new { EmpId = empId, Month = month, Year = year });
        }

        public async Task<IEnumerable<Incentive>> GetEmployeeIncentivesAsync(int empId, int? month, int? year)
        {
            string sql = "SELECT * FROM t_incentives WHERE empid = @EmpId";
            var queryParams = new DynamicParameters();
            queryParams.Add("EmpId", empId);

            if (month.HasValue && month.Value > 0)
            {
                sql += " AND month = @Month";
                queryParams.Add("Month", month.Value);
            }
            if (year.HasValue && year.Value > 0)
            {
                sql += " AND year = @Year";
                queryParams.Add("Year", year.Value);
            }
            sql += " ORDER BY createdat DESC";

            return await _db.QueryAsync<Incentive>(sql, queryParams);
        }

        public async Task<int> AddIncentiveAsync(int empId, int spaceId, int addedBy, decimal amount, string type, string reason, int month, int year)
        {
            var sql = @"
                INSERT INTO t_incentives (empid, spaceid, addedby, amount, type, reason, month, year)
                VALUES (@EmpId, @SpaceId, @AddedBy, @Amount, @Type, @Reason, @Month, @Year)
                RETURNING incentiveid;";

            return await _db.ExecuteScalarAsync<int>(sql, new
            {
                EmpId = empId,
                SpaceId = spaceId,
                AddedBy = addedBy,
                Amount = amount,
                Type = type,
                Reason = reason,
                Month = month,
                Year = year
            });
        }

        public async Task<bool> DeleteIncentiveAsync(int id)
        {
            var sql = "DELETE FROM t_incentives WHERE incentiveid = @Id";
            var rows = await _db.ExecuteAsync(sql, new { Id = id });
            return rows > 0;
        }
    }
}
