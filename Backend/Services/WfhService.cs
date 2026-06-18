using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

namespace Backend.Services
{
    public interface IWfhService
    {
        Task<bool> GrantWfhAsync(int empId, DateTime date, int adminSpaceId);
        Task<bool> RevokeWfhAsync(int empId, DateTime date, int adminSpaceId);
        Task<bool> IsWfhAllowedAsync(int empId, DateTime date);
        Task<IEnumerable<object>> GetWfhPermissionsBySpaceAsync(int spaceId);
        Task<bool> IsIpAllowedAsync(int empId, string? ipAddress);
    }

    public class WfhService : IWfhService
    {
        private readonly IDbConnection _db;

        public WfhService(IDbConnection db)
        {
            _db = db;
        }

        public async Task<bool> IsIpAllowedAsync(int empId, string? ipAddress)
        {
            // Dev override: always allow all IP addresses/networks
            return await Task.FromResult(true);
        }

        public async Task<bool> GrantWfhAsync(int empId, DateTime date, int adminEmpId)
        {
            // Verify the user belongs to a space managed by this admin
            var checkSpaceSql = @"
                SELECT COUNT(1) 
                FROM t_users u
                JOIN t_spaces s ON u.spaceid = s.spaceid
                WHERE u.empid = @EmpId AND s.adminid = @AdminEmpId;";
            var isUnderAdmin = await _db.ExecuteScalarAsync<int>(checkSpaceSql, new { EmpId = empId, AdminEmpId = adminEmpId });
            if (isUnderAdmin == 0)
            {
                throw new UnauthorizedAccessException("Employee is not in your space.");
            }

            var sql = @"
                INSERT INTO t_wfh_permissions (empid, alloweddate)
                VALUES (@EmpId, @Date)
                ON CONFLICT (empid, alloweddate) DO NOTHING;";
            var rows = await _db.ExecuteAsync(sql, new { EmpId = empId, Date = date.Date });
            return rows > 0;
        }

        public async Task<bool> RevokeWfhAsync(int empId, DateTime date, int adminEmpId)
        {
            var checkSpaceSql = @"
                SELECT COUNT(1) 
                FROM t_users u
                JOIN t_spaces s ON u.spaceid = s.spaceid
                WHERE u.empid = @EmpId AND s.adminid = @AdminEmpId;";
            var isUnderAdmin = await _db.ExecuteScalarAsync<int>(checkSpaceSql, new { EmpId = empId, AdminEmpId = adminEmpId });
            if (isUnderAdmin == 0)
            {
                throw new UnauthorizedAccessException("Employee is not in your space.");
            }

            var sql = "DELETE FROM t_wfh_permissions WHERE empid = @EmpId AND alloweddate = @Date;";
            var rows = await _db.ExecuteAsync(sql, new { EmpId = empId, Date = date.Date });
            return rows > 0;
        }

        public async Task<bool> IsWfhAllowedAsync(int empId, DateTime date)
        {
            var sql = "SELECT COUNT(1) FROM t_wfh_permissions WHERE empid = @EmpId AND alloweddate = @Date;";
            var count = await _db.ExecuteScalarAsync<int>(sql, new { EmpId = empId, Date = date.Date });
            return count > 0;
        }

        public async Task<IEnumerable<object>> GetWfhPermissionsBySpaceAsync(int spaceId)
        {
            var sql = @"
                SELECT w.empid, w.alloweddate, u.name, u.email
                FROM t_wfh_permissions w
                JOIN t_users u ON w.empid = u.empid
                JOIN t_spaces s ON u.spaceid = s.spaceid
                WHERE u.spaceid = @SpaceId OR s.adminid = @SpaceId
                ORDER BY w.alloweddate DESC;";
            return await _db.QueryAsync<object>(sql, new { SpaceId = spaceId });
        }
    }
}
