namespace Backend.Repositories;

using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public static class PenaltyCalibrator
{
    public class PenaltyRates
    {
        public decimal AbsentRate { get; set; } = 1000m;
        public decimal LateRate { get; set; } = 200m;
        public decimal EarlyExitRate { get; set; } = 200m;
        public decimal ExcessBreakRate { get; set; } = 150m;
        public decimal PendingTaskRate { get; set; } = 500m;

        // Tracks which deduction IDs are classified as penalties
        public HashSet<int> PenaltyDeductionIds { get; } = new HashSet<int>();
    }

    public static async Task<List<Deduction>> EnsurePenaltyDeductionsAsync(IDbConnection db, int spaceId)
    {
        var sql = "SELECT * FROM t_deductions WHERE spaceid = @SpaceId ORDER BY deductionid ASC;";
        var list = (await db.QueryAsync<Deduction>(sql, new { SpaceId = spaceId })).ToList();

        var absentExists = list.Any(d => (d.DeductionType ?? "").Equals("Absent", StringComparison.OrdinalIgnoreCase) || (d.Name ?? "").Contains("absent", StringComparison.OrdinalIgnoreCase) || (d.Name ?? "").Contains("absence", StringComparison.OrdinalIgnoreCase));
        var lateExists = list.Any(d => (d.DeductionType ?? "").Equals("Late", StringComparison.OrdinalIgnoreCase) || (d.Name ?? "").Contains("late", StringComparison.OrdinalIgnoreCase));
        var earlyExitExists = list.Any(d => (d.DeductionType ?? "").Equals("Early Exit", StringComparison.OrdinalIgnoreCase) || (d.Name ?? "").Contains("early", StringComparison.OrdinalIgnoreCase));
        var breakExists = list.Any(d => (d.DeductionType ?? "").Equals("Excess Break", StringComparison.OrdinalIgnoreCase) || (d.Name ?? "").Contains("break", StringComparison.OrdinalIgnoreCase));
        var taskExists = list.Any(d => (d.DeductionType ?? "").Equals("Pending Tasks", StringComparison.OrdinalIgnoreCase) || (d.Name ?? "").Contains("task", StringComparison.OrdinalIgnoreCase) || (d.Name ?? "").Contains("pending", StringComparison.OrdinalIgnoreCase));

        bool anyMissing = !absentExists || !lateExists || !earlyExitExists || !breakExists || !taskExists;

        if (anyMissing)
        {
            var spaceAdminId = await db.QueryFirstOrDefaultAsync<int?>(
                "SELECT adminid FROM t_spaces WHERE spaceid = @SpaceId", new { SpaceId = spaceId }) ?? 0;

            var insertSql = @"
                INSERT INTO t_deductions (adminid, spaceid, name, type, value, deductiontype, createdat)
                VALUES (@AdminId, @SpaceId, @Name, @Type, @Value, @DeductionType, NOW());";

            if (!absentExists)
            {
                await db.ExecuteAsync(insertSql, new { AdminId = spaceAdminId, SpaceId = spaceId, Name = "Absent Penalty", Type = "Fixed", Value = 1000m, DeductionType = "Absent" });
            }
            if (!lateExists)
            {
                await db.ExecuteAsync(insertSql, new { AdminId = spaceAdminId, SpaceId = spaceId, Name = "Late Clock-In Penalty", Type = "Fixed", Value = 200m, DeductionType = "Late" });
            }
            if (!earlyExitExists)
            {
                await db.ExecuteAsync(insertSql, new { AdminId = spaceAdminId, SpaceId = spaceId, Name = "Early Exit Penalty", Type = "Fixed", Value = 200m, DeductionType = "Early Exit" });
            }
            if (!breakExists)
            {
                await db.ExecuteAsync(insertSql, new { AdminId = spaceAdminId, SpaceId = spaceId, Name = "Excess Break Penalty", Type = "Fixed", Value = 150m, DeductionType = "Excess Break" });
            }
            if (!taskExists)
            {
                await db.ExecuteAsync(insertSql, new { AdminId = spaceAdminId, SpaceId = spaceId, Name = "Pending Tasks Penalty", Type = "Fixed", Value = 500m, DeductionType = "Pending Tasks" });
            }

            list = (await db.QueryAsync<Deduction>(sql, new { SpaceId = spaceId })).ToList();
        }

        return list;
    }

    public static PenaltyRates GetCalibratedRates(decimal basicSalary, IEnumerable<Deduction> deductions)
    {
        var rates = new PenaltyRates();
        if (deductions == null) return rates;

        foreach (var ded in deductions)
        {
            string name = ded.Name ?? "";
            string type = ded.Type ?? "Fixed";
            decimal val = ded.Value;
            decimal calculatedValue = type.Equals("Percentage", StringComparison.OrdinalIgnoreCase)
                ? Math.Round(basicSalary * val / 100m, 2)
                : val;

            string deductionType = ded.DeductionType ?? "";
            bool isPenalty = false;

            if (!string.IsNullOrEmpty(deductionType) && !deductionType.Equals("Standard", StringComparison.OrdinalIgnoreCase))
            {
                if (deductionType.Equals("Absent", StringComparison.OrdinalIgnoreCase))
                {
                    rates.AbsentRate = calculatedValue;
                    isPenalty = true;
                }
                else if (deductionType.Equals("Late", StringComparison.OrdinalIgnoreCase))
                {
                    rates.LateRate = calculatedValue;
                    isPenalty = true;
                }
                else if (deductionType.Equals("Early Exit", StringComparison.OrdinalIgnoreCase))
                {
                    rates.EarlyExitRate = calculatedValue;
                    isPenalty = true;
                }
                else if (deductionType.Equals("Excess Break", StringComparison.OrdinalIgnoreCase))
                {
                    rates.ExcessBreakRate = calculatedValue;
                    isPenalty = true;
                }
                else if (deductionType.Equals("Pending Tasks", StringComparison.OrdinalIgnoreCase))
                {
                    rates.PendingTaskRate = calculatedValue;
                    isPenalty = true;
                }
            }
            else
            {
                // Fallback to name matching
                if (name.Contains("absent", StringComparison.OrdinalIgnoreCase) || name.Contains("absence", StringComparison.OrdinalIgnoreCase))
                {
                    rates.AbsentRate = calculatedValue;
                    isPenalty = true;
                }
                else if (name.Contains("late", StringComparison.OrdinalIgnoreCase))
                {
                    rates.LateRate = calculatedValue;
                    isPenalty = true;
                }
                else if (name.Contains("early", StringComparison.OrdinalIgnoreCase))
                {
                    rates.EarlyExitRate = calculatedValue;
                    isPenalty = true;
                }
                else if (name.Contains("break", StringComparison.OrdinalIgnoreCase))
                {
                    rates.ExcessBreakRate = calculatedValue;
                    isPenalty = true;
                }
                else if (name.Contains("task", StringComparison.OrdinalIgnoreCase) || name.Contains("pending", StringComparison.OrdinalIgnoreCase))
                {
                    rates.PendingTaskRate = calculatedValue;
                    isPenalty = true;
                }
            }

            if (isPenalty && ded.DeductionId > 0)
            {
                rates.PenaltyDeductionIds.Add(ded.DeductionId);
            }
        }

        return rates;
    }
}
