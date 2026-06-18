namespace Backend.Repositories;

using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class LeaveRepository : ILeaveRepository
{
    private readonly IDbConnection _db;

    public LeaveRepository(IDbConnection db)
    {
        _db = db;
    }

    // ─── Apply Leave ─────────────────────────────────────────────────────────
    public async Task<(bool success, string error)> ApplyLeaveAsync(Leave leave)
    {
        try
        {
            // 1. Date validation: must be today or future (no retroactive leave)
            //    Use Date only (strip time), compare against today in server local time
            if (leave.LeaveDate.Date < DateTime.Now.Date)
                return (false, "Cannot apply leave for past dates. Past days without leave are marked as Absent.");

            // 2. Fetch employee record — spaceid may be null (unassigned employee)
            var empRow = await _db.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT empid, spaceid FROM t_users WHERE empid = @EmpId",
                new { leave.EmpId });
            if (empRow == null)
                return (false, "Employee not found.");

            int spaceId = empRow.spaceid != null ? Convert.ToInt32(empRow.spaceid) : 0;
            leave.SpaceId = spaceId;

            // 3. Duplicate leave check
            var existsRaw = await _db.ExecuteScalarAsync(
                "SELECT COUNT(1) FROM t_leaves WHERE empid = @EmpId AND leavedate = @LeaveDate",
                new { leave.EmpId, LeaveDate = leave.LeaveDate.Date });
            if (Convert.ToInt32(existsRaw) > 0)
                return (false, "You have already applied leave for this date.");

            // 4. Emergency/College limit check (only if spaceid is configured)
            if ((leave.LeaveType == "Emergency" || leave.LeaveType == "College") && spaceId > 0)
            {
                var config = await GetSpaceLeaveConfigAsync(spaceId);
                int allowed = leave.LeaveType == "Emergency"
                    ? config.EmergencyLeavesPerMonth
                    : config.CollegeLeavesPerMonth;

                var usedRaw = await _db.ExecuteScalarAsync(
                    @"SELECT COUNT(1) FROM t_leaves
                      WHERE empid = @EmpId
                        AND leavetype = @LeaveType
                        AND status != 'Rejected'
                        AND EXTRACT(MONTH FROM leavedate) = EXTRACT(MONTH FROM CURRENT_DATE)
                        AND EXTRACT(YEAR  FROM leavedate) = EXTRACT(YEAR  FROM CURRENT_DATE)",
                    new { leave.EmpId, LeaveType = leave.LeaveType });

                int used = Convert.ToInt32(usedRaw);
                if (used >= allowed)
                    return (false, $"{leave.LeaveType} leave limit ({allowed}/month) already reached for this month.");
            }

            // 5. Insert leave
            var sql = @"
                INSERT INTO t_leaves (empid, spaceid, leavedate, reason, status, leavetype, halfday, createdat)
                VALUES (@EmpId, @SpaceId, @LeaveDate, @Reason, 'Pending', @LeaveType, @HalfDay, NOW())";

            await _db.ExecuteAsync(sql, new
            {
                leave.EmpId,
                SpaceId  = spaceId > 0 ? (object)spaceId : DBNull.Value,
                LeaveDate = leave.LeaveDate.Date,
                leave.Reason,
                LeaveType = leave.LeaveType ?? "Normal",
                leave.HalfDay
            });

            return (true, "");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.ApplyLeave] Error: {ex.Message}");
            return (false, "An error occurred while applying leave. Please try again.");
        }
    }

    // ─── Get My Leaves ───────────────────────────────────────────────────────
    public async Task<IEnumerable<Leave>> GetLeavesByEmpIdAsync(int empId)
    {
        try
        {
            var sql = @"
                SELECT leaveid, empid, spaceid, leavedate::timestamp AS leavedate,
                       reason, status, leavetype, halfday, createdat, approvedby
                FROM t_leaves
                WHERE empid = @EmpId
                ORDER BY leavedate DESC";
            return await _db.QueryAsync<Leave>(sql, new { EmpId = empId });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.GetLeavesByEmpId] Error: {ex.Message}");
            return Enumerable.Empty<Leave>();
        }
    }

    // ─── Get Leave Balance ────────────────────────────────────────────────────
    public async Task<LeaveBalanceResponse> GetLeaveBalanceAsync(int empId)
    {
        try
        {
            var spaceIdRaw = await _db.ExecuteScalarAsync(
                "SELECT spaceid FROM t_users WHERE empid = @EmpId", new { EmpId = empId });
            int spaceId = spaceIdRaw != null ? Convert.ToInt32(spaceIdRaw) : 0;

            var config = await GetSpaceLeaveConfigAsync(spaceId);

            var rows = await _db.QueryAsync<dynamic>(
                @"SELECT leavetype, COUNT(*)::int AS used
                  FROM t_leaves
                  WHERE empid = @EmpId
                    AND status != 'Rejected'
                    AND EXTRACT(MONTH FROM leavedate) = EXTRACT(MONTH FROM CURRENT_DATE)
                    AND EXTRACT(YEAR  FROM leavedate) = EXTRACT(YEAR  FROM CURRENT_DATE)
                  GROUP BY leavetype",
                new { EmpId = empId });

            int usedEmergency = 0;
            int usedCollege = 0;
            foreach (var row in rows)
            {
                string lt = row.leavetype?.ToString() ?? "";
                int cnt = Convert.ToInt32(row.used ?? 0);
                if (lt == "Emergency") usedEmergency = cnt;
                else if (lt == "College") usedCollege = cnt;
            }

            return new LeaveBalanceResponse
            {
                AllowedEmergency = config.EmergencyLeavesPerMonth,
                AllowedCollege   = config.CollegeLeavesPerMonth,
                UsedEmergency    = usedEmergency,
                UsedCollege      = usedCollege,
                RemainingEmergency = Math.Max(0, config.EmergencyLeavesPerMonth - usedEmergency),
                RemainingCollege   = Math.Max(0, config.CollegeLeavesPerMonth   - usedCollege)
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.GetLeaveBalance] Error: {ex.Message}");
            return new LeaveBalanceResponse
            {
                AllowedEmergency = 1, AllowedCollege = 1,
                RemainingEmergency = 1, RemainingCollege = 1
            };
        }
    }

    // ─── Get All Leaves (role-filtered) ──────────────────────────────────────
    public async Task<IEnumerable<dynamic>> GetAllLeavesAsync(int? spaceId, string role)
    {
        try
        {
            string whereClause = role.Equals("Admin", StringComparison.OrdinalIgnoreCase)
                ? "WHERE l.spaceid IN (SELECT spaceid FROM t_spaces WHERE adminid = @SpaceId AND isactive = TRUE)"
                : "WHERE l.spaceid = @SpaceId";

            var sql = $@"
                SELECT
                    l.leaveid, l.empid, l.spaceid,
                    l.leavedate::timestamp AS leavedate,
                    l.reason, l.status, l.leavetype, l.halfday,
                    l.createdat, l.approvedby,
                    COALESCE(u.name, u.email, 'Employee #' || l.empid::text) AS employeename,
                    u.email
                FROM t_leaves l
                LEFT JOIN t_users u ON u.empid = l.empid
                {whereClause}
                ORDER BY l.leavedate DESC";

            return await _db.QueryAsync<dynamic>(sql, new { SpaceId = spaceId ?? 0 });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.GetAllLeaves] Error: {ex.Message}");
            return Enumerable.Empty<dynamic>();
        }
    }

    // ─── Update Leave Status ──────────────────────────────────────────────────
    public async Task<bool> UpdateLeaveStatusAsync(int leaveId, string status, int approvedByEmpId)
    {
        try
        {
            var sql = @"
                UPDATE t_leaves
                SET status     = @Status,
                    approvedby = @ApprovedBy
                WHERE leaveid = @LeaveId";
            var rows = await _db.ExecuteAsync(sql, new
            {
                Status     = status,
                ApprovedBy = approvedByEmpId,
                LeaveId    = leaveId
            });
            return rows > 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.UpdateLeaveStatus] Error: {ex.Message}");
            return false;
        }
    }

    // ─── Get Leave By Id ──────────────────────────────────────────────────────
    public async Task<Leave?> GetLeaveByIdAsync(int leaveId)
    {
        try
        {
            var sql = @"
                SELECT leaveid, empid, spaceid, leavedate::timestamp AS leavedate,
                       reason, status, leavetype, halfday, createdat, approvedby
                FROM t_leaves
                WHERE leaveid = @LeaveId";
            return await _db.QueryFirstOrDefaultAsync<Leave>(sql, new { LeaveId = leaveId });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.GetLeaveById] Error: {ex.Message}");
            return null;
        }
    }

    // ─── Space Leave Config ───────────────────────────────────────────────────
    public async Task<SpaceLeaveConfig> GetSpaceLeaveConfigAsync(int spaceId)
    {
        try
        {
            var sql = @"
                SELECT configid, spaceid,
                       emergency_leaves_per_month AS EmergencyLeavesPerMonth,
                       college_leaves_per_month   AS CollegeLeavesPerMonth,
                       normal_leaves_per_month    AS NormalLeavesPerMonth,
                       createdat, updatedat
                FROM t_space_leave_config
                WHERE spaceid = @SpaceId";
            var config = await _db.QueryFirstOrDefaultAsync<SpaceLeaveConfig>(sql, new { SpaceId = spaceId });
            return config ?? new SpaceLeaveConfig
            {
                SpaceId = spaceId,
                EmergencyLeavesPerMonth = 1,
                CollegeLeavesPerMonth   = 1,
                NormalLeavesPerMonth    = 999
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.GetSpaceLeaveConfig] Error: {ex.Message}");
            return new SpaceLeaveConfig
            {
                SpaceId = spaceId,
                EmergencyLeavesPerMonth = 1,
                CollegeLeavesPerMonth   = 1,
                NormalLeavesPerMonth    = 999
            };
        }
    }

    public async Task<bool> UpsertSpaceLeaveConfigAsync(SpaceLeaveConfig config)
    {
        try
        {
            var sql = @"
                INSERT INTO t_space_leave_config
                    (spaceid, emergency_leaves_per_month, college_leaves_per_month,
                     normal_leaves_per_month, createdat, updatedat)
                VALUES
                    (@SpaceId, @EmergencyLeavesPerMonth, @CollegeLeavesPerMonth,
                     @NormalLeavesPerMonth, NOW(), NOW())
                ON CONFLICT (spaceid) DO UPDATE SET
                    emergency_leaves_per_month = EXCLUDED.emergency_leaves_per_month,
                    college_leaves_per_month   = EXCLUDED.college_leaves_per_month,
                    normal_leaves_per_month    = EXCLUDED.normal_leaves_per_month,
                    updatedat                  = NOW()";
            var rows = await _db.ExecuteAsync(sql, new
            {
                config.SpaceId,
                config.EmergencyLeavesPerMonth,
                config.CollegeLeavesPerMonth,
                config.NormalLeavesPerMonth
            });
            return rows > 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LeaveRepository.UpsertSpaceLeaveConfig] Error: {ex.Message}");
            return false;
        }
    }
}
