namespace Backend.Repositories;

using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class NoticeRepository : INoticeRepository
{
    private readonly IDbConnection _dbConnection;

    public NoticeRepository(IDbConnection dbConnection)
    {
        _dbConnection = dbConnection;
    }

    public async Task<IEnumerable<Notice>> GetNoticesBySpaceIdAsync(int spaceId)
    {
        var query = "SELECT * FROM t_notices WHERE spaceid = @SpaceId ORDER BY createdat DESC";
        return await _dbConnection.QueryAsync<Notice>(query, new { SpaceId = spaceId });
    }

    public async Task<IEnumerable<Notice>> GetNoticesByEmployeeIdAsync(int empid)
    {
        var query = "SELECT * FROM t_notices WHERE employeeid = @EmpId ORDER BY createdat DESC";
        return await _dbConnection.QueryAsync<Notice>(query, new { EmpId = empid });
    }

    public async Task<int> CreateNoticeAsync(Notice notice)
    {
        if (notice.ToType == "Query")
        {
            notice.Status = "Open";
            if (notice.Preference == "Manager")
            {
                var mgrSql = "SELECT empid FROM t_users WHERE spaceid = @SpaceId AND role = 'Manager' LIMIT 1";
                notice.EmployeeId = await _dbConnection.QueryFirstOrDefaultAsync<int?>(mgrSql, new { SpaceId = notice.SpaceId });
            }
            else if (notice.Preference == "TL")
            {
                var tlSql = "SELECT empid FROM t_users WHERE spaceid = @SpaceId AND role = 'TeamLead' LIMIT 1";
                notice.EmployeeId = await _dbConnection.QueryFirstOrDefaultAsync<int?>(tlSql, new { SpaceId = notice.SpaceId });
            }
            else if (notice.Preference == "Admin")
            {
                var adminSql = "SELECT adminid FROM t_spaces WHERE spaceid = @SpaceId LIMIT 1";
                var adminId = await _dbConnection.QueryFirstOrDefaultAsync<int?>(adminSql, new { SpaceId = notice.SpaceId });
                if (adminId == null || adminId == 0)
                {
                    adminSql = "SELECT empid FROM t_users WHERE spaceid = @SpaceId AND role = 'Admin' LIMIT 1";
                    adminId = await _dbConnection.QueryFirstOrDefaultAsync<int?>(adminSql, new { SpaceId = notice.SpaceId });
                }
                notice.EmployeeId = adminId;
            }
            else
            {
                notice.EmployeeId = null; // SPACE QUERY
            }
        }

        var query = @"
            INSERT INTO t_notices (adminid, spaceid, employeeid, noticetext, totype, createdat, preference, reply, status, repliedby, isdeleted) 
            VALUES (@AdminId, @SpaceId, @EmployeeId, @NoticeText, @ToType, @CreatedAt, @Preference, @Reply, @Status, @RepliedBy, @IsDeleted) 
            RETURNING noticeid;";
        return await _dbConnection.ExecuteScalarAsync<int>(query, notice);
    }

    public async Task<bool> DeleteOldNoticesAsync()
    {
        // Deletes notices older than 3 months
        var query = "DELETE FROM t_notices WHERE createdat < NOW() - INTERVAL '3 months'";
        var result = await _dbConnection.ExecuteAsync(query);
        return result > 0;
    }

    public async Task<IEnumerable<Notice>> GetQueriesAsync(int spaceId, int empId, string role)
    {
        string query;
        if (role == "Admin")
        {
            query = @"
                SELECT * FROM t_notices 
                WHERE isdeleted = FALSE AND totype = 'Query' AND spaceid = @SpaceId 
                ORDER BY createdat DESC";
            return await _dbConnection.QueryAsync<Notice>(query, new { SpaceId = spaceId });
        }
        else
        {
            query = @"
                SELECT * FROM t_notices 
                WHERE isdeleted = FALSE AND totype = 'Query' AND spaceid = @SpaceId 
                AND (
                    adminid = @EmpId 
                    OR employeeid = @EmpId 
                    OR employeeid IS NULL
                ) 
                ORDER BY createdat DESC";
            return await _dbConnection.QueryAsync<Notice>(query, new { SpaceId = spaceId, EmpId = empId });
        }
    }

    public async Task<bool> ReplyToQueryAsync(int noticeId, string reply, int repliedBy)
    {
        var query = @"
            UPDATE t_notices 
            SET 
                reply = @Reply,
                status = 'InProgress',
                repliedby = @RepliedBy
            WHERE noticeid = @NoticeId";
        var result = await _dbConnection.ExecuteAsync(query, new { NoticeId = noticeId, Reply = reply, RepliedBy = repliedBy });
        return result > 0;
    }

    public async Task<bool> SetQueryStatusAsync(int noticeId, string status)
    {
        var query = "UPDATE t_notices SET status = @Status WHERE noticeid = @NoticeId";
        var result = await _dbConnection.ExecuteAsync(query, new { NoticeId = noticeId, Status = status });
        return result > 0;
    }

    public async Task<bool> SoftDeleteQueryAsync(int noticeId)
    {
        var query = "UPDATE t_notices SET isdeleted = TRUE WHERE noticeid = @NoticeId";
        var result = await _dbConnection.ExecuteAsync(query, new { NoticeId = noticeId });
        return result > 0;
    }

    // Real-Time Notification Methods
    public async Task<int> CreateNotificationAsync(Notice notice)
    {
        notice.CreatedAt = DateTime.UtcNow;
        var query = @"
            INSERT INTO t_notices (adminid, spaceid, employeeid, noticetext, totype, createdat, preference, reply, status, repliedby, isdeleted, eventtype, targetrole, is_read_admin, is_read_manager, is_read_tl, is_read_employee) 
            VALUES (@AdminId, @SpaceId, @EmployeeId, @NoticeText, @ToType, @CreatedAt, @Preference, @Reply, @Status, @RepliedBy, @IsDeleted, @EventType, @TargetRole, @IsReadAdmin, @IsReadManager, @IsReadTl, @IsReadEmployee) 
            RETURNING noticeid;";
        return await _dbConnection.ExecuteScalarAsync<int>(query, notice);
    }

     public async Task<IEnumerable<Notice>> GetNotificationsForRoleAsync(string role, int empId, int spaceId)
     {
         if (string.Equals(role, "Admin", System.StringComparison.OrdinalIgnoreCase))
         {
             var query = @"
                 SELECT * FROM t_notices 
                 WHERE isdeleted = FALSE 
                   AND is_read_admin = FALSE
                   AND totype = 'Notification' 
                   AND (targetrole LIKE '%Admin%' OR targetrole LIKE '%System%')
                   AND spaceid = @SpaceId
                 ORDER BY createdat DESC";
             return await _dbConnection.QueryAsync<Notice>(query, new { SpaceId = spaceId });
         }
         else if (string.Equals(role, "Manager", System.StringComparison.OrdinalIgnoreCase))
         {
             var query = @"
                 SELECT * FROM t_notices 
                 WHERE isdeleted = FALSE 
                   AND is_read_manager = FALSE
                   AND totype = 'Notification' 
                   AND targetrole LIKE '%Manager%'
                   AND spaceid = @SpaceId
                 ORDER BY createdat DESC";
             return await _dbConnection.QueryAsync<Notice>(query, new { SpaceId = spaceId });
         }
         else if (string.Equals(role, "TeamLead", System.StringComparison.OrdinalIgnoreCase) || string.Equals(role, "TL", System.StringComparison.OrdinalIgnoreCase))
         {
             var query = @"
                 SELECT * FROM t_notices 
                 WHERE isdeleted = FALSE 
                   AND is_read_tl = FALSE
                   AND totype = 'Notification' 
                   AND (targetrole LIKE '%TL%' OR targetrole LIKE '%TeamLead%')
                   AND spaceid = @SpaceId
                 ORDER BY createdat DESC";
             return await _dbConnection.QueryAsync<Notice>(query, new { SpaceId = spaceId });
         }
        else
        {
            var query = @"
                SELECT * FROM t_notices 
                WHERE isdeleted = FALSE 
                  AND is_read_employee = FALSE
                  AND (
                    (totype = 'Warning' AND employeeid = @EmpId) OR
                    (totype = 'Notice' AND spaceid = @SpaceId) OR
                    (totype = 'Query' AND adminid = @EmpId AND reply IS NOT NULL)
                  )
                ORDER BY createdat DESC";
            return await _dbConnection.QueryAsync<Notice>(query, new { EmpId = empId, SpaceId = spaceId });
        }
    }

    public async Task<bool> MarkNotificationAsReadAsync(int noticeId, string role)
    {
        string query;
        if (string.Equals(role, "Admin", System.StringComparison.OrdinalIgnoreCase))
        {
            query = "UPDATE t_notices SET is_read_admin = TRUE WHERE noticeid = @NoticeId";
        }
        else if (string.Equals(role, "Manager", System.StringComparison.OrdinalIgnoreCase))
        {
            query = "UPDATE t_notices SET is_read_manager = TRUE WHERE noticeid = @NoticeId";
        }
        else if (string.Equals(role, "TeamLead", System.StringComparison.OrdinalIgnoreCase) || string.Equals(role, "TL", System.StringComparison.OrdinalIgnoreCase))
        {
            query = "UPDATE t_notices SET is_read_tl = TRUE WHERE noticeid = @NoticeId";
        }
        else
        {
            query = "UPDATE t_notices SET is_read_employee = TRUE WHERE noticeid = @NoticeId";
        }
        var result = await _dbConnection.ExecuteAsync(query, new { NoticeId = noticeId });
        return result > 0;
    }
}
