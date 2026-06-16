using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

namespace Backend.Services
{
    public interface IBonusTaskService
    {
        Task<int> CreateBonusTaskAsync(BonusTask task, int adminSpaceId);
        Task<bool> AssignBonusTaskAsync(int taskId, int empId, int adminSpaceId);
        Task<bool> CompleteBonusTaskAsync(int taskId, int empId);
        Task<IEnumerable<BonusTask>> GetBonusTasksBySpaceAsync(int spaceId);
        Task<IEnumerable<BonusTask>> GetMyBonusTasksAsync(int empId);
        Task<decimal> GetUnpaidBonusAmountAsync(int empId);
        Task MarkBonusTasksAsPaidAsync(int empId, IDbTransaction transaction);
    }

    public class BonusTaskService : IBonusTaskService
    {
        private readonly IDbConnection _db;

        public BonusTaskService(IDbConnection db)
        {
            _db = db;
        }

        public async Task<int> CreateBonusTaskAsync(BonusTask task, int adminSpaceId)
        {
            task.SpaceId = adminSpaceId;
            task.Status = "Pending";

            var sql = @"
                INSERT INTO t_bonus_tasks (title, description, spaceid, bonus_amount, status)
                VALUES (@Title, @Description, @SpaceId, @BonusAmount, 'Pending')
                RETURNING taskid;";
            return await _db.ExecuteScalarAsync<int>(sql, task);
        }

        public async Task<bool> AssignBonusTaskAsync(int taskId, int empId, int adminSpaceId)
        {
            // Verify employee is in same space
            var verifySql = "SELECT spaceid FROM t_users WHERE empid = @EmpId;";
            var userSpaceId = await _db.ExecuteScalarAsync<int?>(verifySql, new { EmpId = empId });
            if (userSpaceId == null || userSpaceId != adminSpaceId)
            {
                throw new UnauthorizedAccessException("Employee is not in your space.");
            }

            var sql = @"
                UPDATE t_bonus_tasks
                SET assigned_to = @EmpId
                WHERE taskid = @TaskId AND spaceid = @SpaceId;";
            var rows = await _db.ExecuteAsync(sql, new { EmpId = empId, TaskId = taskId, SpaceId = adminSpaceId });
            return rows > 0;
        }

        public async Task<bool> CompleteBonusTaskAsync(int taskId, int empId)
        {
            var sql = @"
                UPDATE t_bonus_tasks
                SET status = 'Completed', completed_at = NOW()
                WHERE taskid = @TaskId AND assigned_to = @EmpId AND status = 'Pending';";
            var rows = await _db.ExecuteAsync(sql, new { TaskId = taskId, EmpId = empId });
            return rows > 0;
        }

        public async Task<IEnumerable<BonusTask>> GetBonusTasksBySpaceAsync(int spaceId)
        {
            var sql = @"
                SELECT taskid, title, description, spaceid, bonus_amount AS bonusamount, status, assigned_to AS assignedto, completed_at AS completedat
                FROM t_bonus_tasks
                WHERE spaceid = @SpaceId
                ORDER BY taskid DESC;";
            return await _db.QueryAsync<BonusTask>(sql, new { SpaceId = spaceId });
        }

        public async Task<IEnumerable<BonusTask>> GetMyBonusTasksAsync(int empId)
        {
            var sql = @"
                SELECT taskid, title, description, spaceid, bonus_amount AS bonusamount, status, assigned_to AS assignedto, completed_at AS completedat
                FROM t_bonus_tasks
                WHERE assigned_to = @EmpId
                ORDER BY taskid DESC;";
            return await _db.QueryAsync<BonusTask>(sql, new { EmpId = empId });
        }

        public async Task<decimal> GetUnpaidBonusAmountAsync(int empId)
        {
            var sql = "SELECT COALESCE(SUM(bonus_amount), 0) FROM t_bonus_tasks WHERE assigned_to = @EmpId AND status = 'Completed';";
            return await _db.ExecuteScalarAsync<decimal>(sql, new { EmpId = empId });
        }

        public async Task MarkBonusTasksAsPaidAsync(int empId, IDbTransaction transaction)
        {
            var sql = @"
                UPDATE t_bonus_tasks
                SET status = 'Paid'
                WHERE assigned_to = @EmpId AND status = 'Completed';";
            await _db.ExecuteAsync(sql, new { EmpId = empId }, transaction);
        }
    }
}
