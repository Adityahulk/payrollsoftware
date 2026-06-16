using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

namespace Backend.Services
{
    public interface IAuditLogService
    {
        Task LogActionAsync(int empId, string action, string details, string? ipAddress);
        Task<IEnumerable<AuditLog>> GetLogsBySpaceAsync(int spaceId);
    }

    public class AuditLogService : IAuditLogService
    {
        private readonly IDbConnection _db;

        public AuditLogService(IDbConnection db)
        {
            _db = db;
        }

        public async Task LogActionAsync(int empId, string action, string details, string? ipAddress)
        {
            var sql = @"
                INSERT INTO t_audit_logs (empid, action, details, ipaddress, createdat)
                VALUES (@EmpId, @Action, @Details, @IpAddress, NOW());";
            await _db.ExecuteAsync(sql, new { EmpId = empId, Action = action, Details = details, IpAddress = ipAddress });
        }

        public async Task<IEnumerable<AuditLog>> GetLogsBySpaceAsync(int spaceId)
        {
            var sql = @"
                SELECT a.logid, a.empid, a.action, a.details, a.ipaddress, a.createdat
                FROM t_audit_logs a
                JOIN t_users u ON a.empid = u.empid
                WHERE u.spaceid = @SpaceId
                ORDER BY a.createdat DESC;";
            return await _db.QueryAsync<AuditLog>(sql, new { SpaceId = spaceId });
        }
    }
}
