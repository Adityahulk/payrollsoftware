namespace Backend.Repositories;

using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class DashboardRepository : IDashboardRepository
{
    private readonly IDbConnection _db;

    public DashboardRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<IEnumerable<RecentWorklogDto>> GetRecentWorklogsAsync(int adminId, int days)
    {
        var sql = @"
            SELECT 
                w.logid AS LogId,
                w.empid AS EmpId,
                COALESCE(NULLIF(TRIM(u.name), ''), 'Employee') AS Name,
                COALESCE(w.hoursworked, 0) AS HoursWorked,
                COALESCE(NULLIF(TRIM(w.description), ''), 'No description') AS Description,
                w.workdate::timestamp AS WorkDate,
                w.createdat AS CreatedAt
            FROM t_worklogs w
            JOIN t_users u ON u.empid = w.empid
            JOIN t_spaces s ON u.spaceid = s.spaceid
            WHERE 
                s.adminid = @AdminId
                AND w.workdate IS NOT NULL
                AND w.workdate >= CURRENT_DATE - (@Days * INTERVAL '1 day')
            ORDER BY w.createdat DESC
            LIMIT 10;";
        
        return await _db.QueryAsync<RecentWorklogDto>(sql, new { AdminId = adminId, Days = days });
    }

    public async Task<IEnumerable<RecentEmployeeDto>> GetRecentEmployeesAsync(int adminId, int days)
    {
        var sql = @"
            SELECT 
                u.empid AS EmpId,
                COALESCE(NULLIF(TRIM(u.name), ''), 'Employee') AS Name,
                COALESCE(u.email, '') AS Email,
                COALESCE(u.role, 'Employee') AS Role,
                COALESCE(u.dateofjoining, CURRENT_DATE)::timestamp AS DateOfJoining,
                COALESCE(s.spacename, 'Space') AS SpaceName
            FROM t_users u
            JOIN t_spaces s ON u.spaceid = s.spaceid
            WHERE 
                s.adminid = @AdminId
                AND u.dateofjoining IS NOT NULL
                AND u.dateofjoining >= CURRENT_DATE - (@Days * INTERVAL '1 day')
            ORDER BY u.dateofjoining DESC;";
            
        return await _db.QueryAsync<RecentEmployeeDto>(sql, new { AdminId = adminId, Days = days });
    }
}
