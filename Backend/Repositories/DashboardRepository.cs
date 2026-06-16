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
                w.createdat AS CreatedAt,
                a.clockin AS ClockIn,
                a.clockout AS ClockOut,
                a.attendancedate::timestamp AS AttendanceDate,
                t.tasktitle AS TaskTitle
            FROM t_worklogs w
            JOIN t_users u ON u.empid = w.empid
            JOIN t_spaces s ON u.spaceid = s.spaceid
            LEFT JOIN t_projecttasks t ON w.taskid = t.taskid
            LEFT JOIN t_attendance a ON a.empid = w.empid AND a.attendancedate = w.workdate
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

    // New: single-call admin summary replacing 5+ frontend API calls
    public async Task<AdminSummaryDto> GetAdminSummaryAsync(int adminId)
    {
        var sql = @"
            -- Q1: total employees (non-admin) under this admin's spaces
            SELECT COUNT(u.empid)
            FROM t_users u
            JOIN t_spaces s ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId AND u.role != 'Admin';

            -- Q2: present today
            SELECT COUNT(DISTINCT a.empid)
            FROM t_attendance a
            JOIN t_users u ON a.empid = u.empid
            JOIN t_spaces s ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId
              AND DATE(a.clockin) = CURRENT_DATE;

            -- Q3: total payroll (sum of basic salary for current month from employeesalary table)
            SELECT COALESCE(SUM(es.basic), 0)
            FROM t_employeesalary es
            JOIN t_users u ON es.empid = u.empid
            JOIN t_spaces s ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId AND u.role != 'Admin';

            -- Q4: pending leave requests
            SELECT COUNT(l.leaveid)
            FROM t_leaves l
            JOIN t_users u ON l.empid = u.empid
            JOIN t_spaces s ON u.spaceid = s.spaceid
            WHERE s.adminid = @AdminId AND l.status = 'Pending';

            -- Q5: total spaces
            SELECT COUNT(spaceid)
            FROM t_spaces
            WHERE adminid = @AdminId AND (isactive = true);

            -- Q6: active contracts (spaces with contract type)
            SELECT COUNT(spaceid)
            FROM t_spaces
            WHERE adminid = @AdminId
              AND type = 'Contract'
              AND (isactive = true);";

        try
        {
            using var multi = await _db.QueryMultipleAsync(sql, new { AdminId = adminId });

            int totalEmployees  = (int)(await multi.ReadFirstOrDefaultAsync<long>());
            int presentToday    = (int)(await multi.ReadFirstOrDefaultAsync<long>());
            decimal totalPayroll= await multi.ReadFirstOrDefaultAsync<decimal>();
            int pendingLeaves   = (int)(await multi.ReadFirstOrDefaultAsync<long>());
            int totalSpaces     = (int)(await multi.ReadFirstOrDefaultAsync<long>());
            int activeContracts = (int)(await multi.ReadFirstOrDefaultAsync<long>());

            return new AdminSummaryDto
            {
                TotalEmployees  = totalEmployees,
                PresentToday    = presentToday,
                AbsentToday     = Math.Max(0, totalEmployees - presentToday),
                TotalPayroll    = totalPayroll,
                PendingLeaves   = pendingLeaves,
                TotalSpaces     = totalSpaces,
                ActiveContracts = activeContracts
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DashboardRepo.GetAdminSummaryAsync] Error: {ex.Message}");
            // Graceful fallback with zeros on error
            return new AdminSummaryDto();
        }
    }
}
