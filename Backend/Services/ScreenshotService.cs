using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

namespace Backend.Services
{
    public interface IScreenshotService
    {
        // ── Config ──
        Task<ScreenshotConfig> GetOrCreateConfigAsync(int spaceId, int? empId = null);
        Task<bool> SaveConfigAsync(ScreenshotConfig config);

        // ── Screenshot logs (employee_screenshots table — old system) ──
        Task<int> SaveScreenshotAsync(Screenshot screenshot);
        Task<IEnumerable<Screenshot>> GetScreenshotsAsync(int empId, DateTime? date, int spaceId);

        // ── Live Monitoring Screenshot Log (t_employee_screenshot_logs) ──
        Task<int> SaveScreenshotLogAsync(EmployeeScreenshotLog log);
        Task<IEnumerable<EmployeeScreenshotLog>> GetScreenshotLogsAsync(int empId, DateTime? date, int spaceId);
        Task<IEnumerable<EmployeeLatestScreenshot>> GetLatestScreenshotsForSpaceAsync(int spaceId);
        Task<IEnumerable<EmployeeScreenshotLog>> GetRecentScreenshotLogsAsync(int empId, int minutes, int spaceId);

        // ── Purge Screenshots — dynamic (uses per-space config) ──
        Task<IEnumerable<EmployeeScreenshotLog>> GetExpiredScreenshotLogsDynamicAsync(int retentionDays);
        Task<int> PurgeExpiredScreenshotLogsDynamicAsync(int retentionDays);

        // ── Live Monitoring Video Log (t_employee_video_logs) ──
        Task<int> SaveVideoLogAsync(EmployeeVideoLog log);
        Task<IEnumerable<EmployeeVideoLog>> GetRecentVideoLogsAsync(int empId, int minutes, int spaceId);

        // ── Purge Videos — dynamic (uses per-space config) ──
        Task<IEnumerable<EmployeeVideoLog>> GetExpiredVideoLogsDynamicAsync(int retentionMinutes);
        Task<int> PurgeExpiredVideoLogsDynamicAsync(int retentionMinutes);

        // ── Legacy fixed-interval purge (kept for backward compatibility) ──
        Task<IEnumerable<EmployeeScreenshotLog>> GetExpiredScreenshotLogsAsync();
        Task<int> PurgeExpiredScreenshotLogsAsync();
        Task<IEnumerable<EmployeeScreenshotLog>> GetExpiredScreenshotLogs30MinsAsync();
        Task<int> PurgeExpiredScreenshotLogs30MinsAsync();
        Task<IEnumerable<EmployeeVideoLog>> GetExpiredVideoLogs30MinsAsync();
        Task<int> PurgeExpiredVideoLogs30MinsAsync();
    }

    public class ScreenshotService : IScreenshotService
    {
        private readonly IDbConnection _db;

        public ScreenshotService(IDbConnection db)
        {
            _db = db;
        }

        // ─────────────────────────────────────────────────────────────────────────────
        //  CONFIG
        // ─────────────────────────────────────────────────────────────────────────────

        public async Task<ScreenshotConfig> GetOrCreateConfigAsync(int spaceId, int? empId = null)
        {
            if (empId.HasValue && empId.Value > 0)
            {
                var empSql = @"
                    SELECT id,
                           spaceid,
                           empid,
                           interval_minutes               AS intervalminutes,
                           is_enabled                     AS isenabled,
                           COALESCE(screenshot_retention_days, 60)  AS screenshotretentiondays,
                           COALESCE(video_retention_minutes, 15)     AS videoretentionminutes,
                           createdat,
                           updatedat
                    FROM screenshot_config
                    WHERE empid = @EmpId;";
                var config = await _db.QueryFirstOrDefaultAsync<ScreenshotConfig>(empSql, new { EmpId = empId.Value });
                if (config != null)
                {
                    return config;
                }
            }

            var spaceSql = @"
                SELECT id,
                       spaceid,
                       empid,
                       interval_minutes               AS intervalminutes,
                       is_enabled                     AS isenabled,
                       COALESCE(screenshot_retention_days, 60)  AS screenshotretentiondays,
                       COALESCE(video_retention_minutes, 15)     AS videoretentionminutes,
                       createdat,
                       updatedat
                FROM screenshot_config
                WHERE spaceid = @SpaceId AND empid IS NULL;";
            var spaceConfig = await _db.QueryFirstOrDefaultAsync<ScreenshotConfig>(spaceSql, new { SpaceId = spaceId });
            if (spaceConfig == null)
            {
                var insertSql = @"
                    INSERT INTO screenshot_config
                        (spaceid, empid, interval_minutes, is_enabled, screenshot_retention_days, video_retention_minutes, createdat, updatedat)
                    VALUES (@SpaceId, NULL, 30, FALSE, 60, 15, NOW(), NOW())
                    ON CONFLICT (spaceid) WHERE empid IS NULL DO NOTHING;

                    SELECT id,
                           spaceid,
                           empid,
                           interval_minutes               AS intervalminutes,
                           is_enabled                     AS isenabled,
                           COALESCE(screenshot_retention_days, 60)  AS screenshotretentiondays,
                           COALESCE(video_retention_minutes, 15)     AS videoretentionminutes,
                           createdat,
                           updatedat
                    FROM screenshot_config WHERE spaceid = @SpaceId AND empid IS NULL;";
                spaceConfig = await _db.QueryFirstOrDefaultAsync<ScreenshotConfig>(insertSql, new { SpaceId = spaceId });
            }

            if (empId.HasValue && empId.Value > 0 && spaceConfig != null)
            {
                return new ScreenshotConfig
                {
                    Id = spaceConfig.Id,
                    SpaceId = spaceConfig.SpaceId,
                    EmpId = empId,
                    IntervalMinutes = spaceConfig.IntervalMinutes,
                    IsEnabled = spaceConfig.IsEnabled,
                    ScreenshotRetentionDays = spaceConfig.ScreenshotRetentionDays,
                    VideoRetentionMinutes = spaceConfig.VideoRetentionMinutes,
                    CreatedAt = spaceConfig.CreatedAt,
                    UpdatedAt = spaceConfig.UpdatedAt
                };
            }

            return spaceConfig!;
        }

        public async Task<bool> SaveConfigAsync(ScreenshotConfig config)
        {
            if (config.EmpId.HasValue && config.EmpId.Value > 0)
            {
                var sql = @"
                    INSERT INTO screenshot_config
                        (spaceid, empid, interval_minutes, is_enabled, screenshot_retention_days, video_retention_minutes, updatedat)
                    VALUES (@SpaceId, @EmpId, @IntervalMinutes, @IsEnabled, @ScreenshotRetentionDays, @VideoRetentionMinutes, NOW())
                    ON CONFLICT (empid) DO UPDATE
                    SET interval_minutes             = EXCLUDED.interval_minutes,
                        is_enabled                   = EXCLUDED.is_enabled,
                        screenshot_retention_days    = EXCLUDED.screenshot_retention_days,
                        video_retention_minutes      = EXCLUDED.video_retention_minutes,
                        updatedat                    = NOW();";
                var rows = await _db.ExecuteAsync(sql, config);
                return rows > 0;
            }
            else
            {
                var sql = @"
                    INSERT INTO screenshot_config
                        (spaceid, empid, interval_minutes, is_enabled, screenshot_retention_days, video_retention_minutes, updatedat)
                    VALUES (@SpaceId, NULL, @IntervalMinutes, @IsEnabled, @ScreenshotRetentionDays, @VideoRetentionMinutes, NOW())
                    ON CONFLICT (spaceid) WHERE empid IS NULL DO UPDATE
                    SET interval_minutes             = EXCLUDED.interval_minutes,
                        is_enabled                   = EXCLUDED.is_enabled,
                        screenshot_retention_days    = EXCLUDED.screenshot_retention_days,
                        video_retention_minutes      = EXCLUDED.video_retention_minutes,
                        updatedat                    = NOW();";
                var rows = await _db.ExecuteAsync(sql, config);
                return rows > 0;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────────
        //  SCREENSHOT LOG (employee_screenshots table - old system)
        // ─────────────────────────────────────────────────────────────────────────────

        public async Task<int> SaveScreenshotAsync(Screenshot screenshot)
        {
            var sql = @"
                INSERT INTO employee_screenshots (empid, spaceid, fileurl, capturedat)
                VALUES (@EmpId, @SpaceId, @FileUrl, @CapturedAt)
                RETURNING screenshotid;";
            return await _db.ExecuteScalarAsync<int>(sql, screenshot);
        }

        public async Task<IEnumerable<Screenshot>> GetScreenshotsAsync(int empId, DateTime? date, int spaceId)
        {
            var checkSql = "SELECT spaceid FROM t_users WHERE empid = @EmpId;";
            var empSpaceId = await _db.ExecuteScalarAsync<int?>(checkSql, new { EmpId = empId });
            if (empSpaceId == null || empSpaceId != spaceId)
                throw new UnauthorizedAccessException("Requested employee screenshots are outside your department scope.");

            var sql = @"SELECT screenshotid, empid, spaceid, fileurl, capturedat
                        FROM employee_screenshots WHERE empid = @EmpId ";
            if (date.HasValue) sql += " AND capturedat::date = @Date::date ";
            sql += " ORDER BY capturedat DESC;";
            var res = await _db.QueryAsync<Screenshot>(sql, new { EmpId = empId, Date = date });
            foreach (var r in res)
            {
                r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt, DateTimeKind.Utc);
            }
            return res;
        }

        // ─────────────────────────────────────────────────────────────────────────────
        //  LIVE MONITORING SCREENSHOT LOG (t_employee_screenshot_logs)
        // ─────────────────────────────────────────────────────────────────────────────

        public async Task<int> SaveScreenshotLogAsync(EmployeeScreenshotLog log)
        {
            var sql = @"
                INSERT INTO t_employee_screenshot_logs (empid, screenshoturl, captured_at)
                VALUES (@EmpId, @ScreenshotUrl, @CapturedAt)
                RETURNING logid;";
            return await _db.ExecuteScalarAsync<int>(sql, log);
        }

        public async Task<IEnumerable<EmployeeScreenshotLog>> GetScreenshotLogsAsync(int empId, DateTime? date, int spaceId)
        {
            var checkSql = "SELECT spaceid FROM t_users WHERE empid = @EmpId;";
            var empSpaceId = await _db.ExecuteScalarAsync<int?>(checkSql, new { EmpId = empId });
            if (empSpaceId == null || empSpaceId != spaceId)
                throw new UnauthorizedAccessException("Requested employee is outside your department scope.");

            var sql = @"SELECT logid, empid, screenshoturl, captured_at AS capturedat
                        FROM t_employee_screenshot_logs WHERE empid = @EmpId ";
            if (date.HasValue) sql += " AND captured_at::date = @Date::date ";
            sql += " ORDER BY captured_at DESC;";
            var res = await _db.QueryAsync<EmployeeScreenshotLog>(sql, new { EmpId = empId, Date = date });
            foreach (var r in res)
            {
                r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt, DateTimeKind.Utc);
            }
            return res;
        }

        public async Task<IEnumerable<EmployeeLatestScreenshot>> GetLatestScreenshotsForSpaceAsync(int spaceId)
        {
            var sql = @"
                SELECT
                    u.empid          AS EmpId,
                    u.name           AS Name,
                    u.email          AS Email,
                    l.screenshoturl  AS LatestScreenshotUrl,
                    l.captured_at    AS CapturedAt
                FROM t_users u
                LEFT JOIN (
                    SELECT DISTINCT ON (empid) empid, screenshoturl, captured_at
                    FROM t_employee_screenshot_logs
                    ORDER BY empid, captured_at DESC
                ) l ON u.empid = l.empid
                WHERE u.spaceid = @SpaceId AND LOWER(COALESCE(u.role, '')) != 'admin';";
            var res = await _db.QueryAsync<EmployeeLatestScreenshot>(sql, new { SpaceId = spaceId });
            foreach (var r in res)
            {
                if (r.CapturedAt.HasValue)
                {
                    r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt.Value, DateTimeKind.Utc);
                }
                if (string.IsNullOrEmpty(r.Name))
                {
                    if (!string.IsNullOrEmpty(r.Email))
                    {
                        var parts = r.Email.Split('@');
                        var derived = parts[0].Replace(".", " ").Replace("_", " ").Replace("-", " ");
                        r.Name = System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(derived);
                    }
                    else
                    {
                        r.Name = $"Employee #{r.EmpId}";
                    }
                }
            }
            return res;
        }

        public async Task<IEnumerable<EmployeeScreenshotLog>> GetRecentScreenshotLogsAsync(int empId, int minutes, int spaceId)
        {
            var sql = @"
                SELECT 
                    s.logid, 
                    s.empid, 
                    s.screenshoturl, 
                    s.captured_at AS capturedat,
                    u.name AS employeename,
                    u.spaceid AS userspaceid,
                    u.empid AS userempid,
                    u.email AS useremail
                FROM t_employee_screenshot_logs s
                LEFT JOIN t_users u ON s.empid = u.empid
                WHERE s.empid = @EmpId
                  AND s.captured_at >= ((now() at time zone 'utc') - (INTERVAL '1 minute' * @Minutes))
                ORDER BY s.captured_at DESC;";
            var res = await _db.QueryAsync<EmployeeScreenshotLog>(sql, new { EmpId = empId, Minutes = minutes });
            var filtered = new List<EmployeeScreenshotLog>();
            foreach (var r in res)
            {
                r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt, DateTimeKind.Utc);
                if (r.UserSpaceId.HasValue && r.UserSpaceId.Value != spaceId)
                {
                    continue; // Prevent cross-space data leakage
                }
                if (!r.UserEmpId.HasValue || r.UserEmpId.Value == 0)
                {
                    r.EmployeeName = "Deleted / Unassigned Employee";
                    Console.WriteLine($"[Warning] Screenshot LogId {r.LogId} has empid {r.EmpId} with no matching user.");
                }
                else if (string.IsNullOrEmpty(r.EmployeeName))
                {
                    if (!string.IsNullOrEmpty(r.UserEmail))
                    {
                        var parts = r.UserEmail.Split('@');
                        var derived = parts[0].Replace(".", " ").Replace("_", " ").Replace("-", " ");
                        r.EmployeeName = System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(derived);
                    }
                    else
                    {
                        r.EmployeeName = $"Employee #{r.EmpId}";
                    }
                }
                filtered.Add(r);
            }
            return filtered;
        }

        // ─────────────────────────────────────────────────────────────────────────────
        //  DYNAMIC PURGE — Screenshots (uses per-space/employee retention config in days)
        // ─────────────────────────────────────────────────────────────────────────────

        public async Task<IEnumerable<EmployeeScreenshotLog>> GetExpiredScreenshotLogsDynamicAsync(int retentionDays)
        {
            var sql = @"
                SELECT l.logid, l.empid, l.screenshoturl, l.captured_at AS capturedat
                FROM t_employee_screenshot_logs l
                JOIN t_users u ON l.empid = u.empid
                LEFT JOIN screenshot_config e ON u.empid = e.empid
                LEFT JOIN screenshot_config s ON u.spaceid = s.spaceid AND s.empid IS NULL
                WHERE l.captured_at < ((now() at time zone 'utc') - (INTERVAL '1 day' * COALESCE(e.screenshot_retention_days, s.screenshot_retention_days, 60)))
                ORDER BY l.captured_at ASC;";
            var res = await _db.QueryAsync<EmployeeScreenshotLog>(sql);
            foreach (var r in res)
            {
                r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt, DateTimeKind.Utc);
            }
            return res;
        }

        public async Task<int> PurgeExpiredScreenshotLogsDynamicAsync(int retentionDays)
        {
            var sql = @"
                DELETE FROM t_employee_screenshot_logs
                WHERE logid IN (
                    SELECT l.logid
                    FROM t_employee_screenshot_logs l
                    JOIN t_users u ON l.empid = u.empid
                    LEFT JOIN screenshot_config e ON u.empid = e.empid
                    LEFT JOIN screenshot_config s ON u.spaceid = s.spaceid AND s.empid IS NULL
                    WHERE l.captured_at < ((now() at time zone 'utc') - (INTERVAL '1 day' * COALESCE(e.screenshot_retention_days, s.screenshot_retention_days, 60)))
                );";
            return await _db.ExecuteAsync(sql);
        }

        // ─────────────────────────────────────────────────────────────────────────────
        //  VIDEO LOG (t_employee_video_logs)
        // ─────────────────────────────────────────────────────────────────────────────

        public async Task<int> SaveVideoLogAsync(EmployeeVideoLog log)
        {
            var sql = @"
                INSERT INTO t_employee_video_logs (empid, videourl, captured_at)
                VALUES (@EmpId, @VideoUrl, @CapturedAt)
                RETURNING logid;";
            return await _db.ExecuteScalarAsync<int>(sql, log);
        }

        public async Task<IEnumerable<EmployeeVideoLog>> GetRecentVideoLogsAsync(int empId, int minutes, int spaceId)
        {
            var sql = @"
                SELECT 
                    v.logid, 
                    v.empid, 
                    v.videourl, 
                    v.captured_at AS capturedat,
                    u.name AS employeename,
                    u.spaceid AS userspaceid,
                    u.empid AS userempid,
                    u.email AS useremail
                FROM t_employee_video_logs v
                LEFT JOIN t_users u ON v.empid = u.empid
                WHERE v.empid = @EmpId
                  AND v.captured_at >= ((now() at time zone 'utc') - (INTERVAL '1 minute' * @Minutes))
                ORDER BY v.captured_at DESC;";
            var res = await _db.QueryAsync<EmployeeVideoLog>(sql, new { EmpId = empId, Minutes = minutes });
            var filtered = new List<EmployeeVideoLog>();
            foreach (var r in res)
            {
                r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt, DateTimeKind.Utc);
                if (r.UserSpaceId.HasValue && r.UserSpaceId.Value != spaceId)
                {
                    continue; // Prevent cross-space data leakage
                }
                if (!r.UserEmpId.HasValue || r.UserEmpId.Value == 0)
                {
                    r.EmployeeName = "Deleted / Unassigned Employee";
                    Console.WriteLine($"[Warning] Video LogId {r.LogId} has empid {r.EmpId} with no matching user.");
                }
                else if (string.IsNullOrEmpty(r.EmployeeName))
                {
                    if (!string.IsNullOrEmpty(r.UserEmail))
                    {
                        var parts = r.UserEmail.Split('@');
                        var derived = parts[0].Replace(".", " ").Replace("_", " ").Replace("-", " ");
                        r.EmployeeName = System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(derived);
                    }
                    else
                    {
                        r.EmployeeName = $"Employee #{r.EmpId}";
                    }
                }
                filtered.Add(r);
            }
            return filtered;
        }

        // ─────────────────────────────────────────────────────────────────────────────
        //  DYNAMIC PURGE — Videos (uses per-space/employee retention config in minutes)
        // ─────────────────────────────────────────────────────────────────────────────

        public async Task<IEnumerable<EmployeeVideoLog>> GetExpiredVideoLogsDynamicAsync(int retentionMinutes)
        {
            var sql = @"
                SELECT l.logid, l.empid, l.videourl, l.captured_at AS capturedat
                FROM t_employee_video_logs l
                JOIN t_users u ON l.empid = u.empid
                LEFT JOIN screenshot_config e ON u.empid = e.empid
                LEFT JOIN screenshot_config s ON u.spaceid = s.spaceid AND s.empid IS NULL
                WHERE l.captured_at < ((now() at time zone 'utc') - (INTERVAL '1 minute' * COALESCE(e.video_retention_minutes, s.video_retention_minutes, 15)))
                ORDER BY l.captured_at ASC;";
            var res = await _db.QueryAsync<EmployeeVideoLog>(sql);
            foreach (var r in res)
            {
                r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt, DateTimeKind.Utc);
            }
            return res;
        }

        public async Task<int> PurgeExpiredVideoLogsDynamicAsync(int retentionMinutes)
        {
            var sql = @"
                DELETE FROM t_employee_video_logs
                WHERE logid IN (
                    SELECT l.logid
                    FROM t_employee_video_logs l
                    JOIN t_users u ON l.empid = u.empid
                    LEFT JOIN screenshot_config e ON u.empid = e.empid
                    LEFT JOIN screenshot_config s ON u.spaceid = s.spaceid AND s.empid IS NULL
                    WHERE l.captured_at < ((now() at time zone 'utc') - (INTERVAL '1 minute' * COALESCE(e.video_retention_minutes, s.video_retention_minutes, 15)))
                );";
            return await _db.ExecuteAsync(sql);
        }

        // ─────────────────────────────────────────────────────────────────────────────
        //  LEGACY (kept for backward compatibility — hardcoded intervals)
        // ─────────────────────────────────────────────────────────────────────────────

        public async Task<IEnumerable<EmployeeScreenshotLog>> GetExpiredScreenshotLogsAsync()
        {
            var sql = @"
                SELECT logid, empid, screenshoturl, captured_at AS capturedat
                FROM t_employee_screenshot_logs
                WHERE captured_at < ((now() at time zone 'utc') - INTERVAL '2 months')
                ORDER BY captured_at ASC;";
            var res = await _db.QueryAsync<EmployeeScreenshotLog>(sql);
            foreach (var r in res)
            {
                r.CapturedAt = DateTime.SpecifyKind(r.CapturedAt, DateTimeKind.Utc);
            }
            return res;
        }

        public async Task<int> PurgeExpiredScreenshotLogsAsync()
        {
            var sql = "DELETE FROM t_employee_screenshot_logs WHERE captured_at < ((now() at time zone 'utc') - INTERVAL '2 months');";
            return await _db.ExecuteAsync(sql);
        }

        public async Task<IEnumerable<EmployeeScreenshotLog>> GetExpiredScreenshotLogs30MinsAsync()
        {
            return await GetExpiredScreenshotLogsDynamicAsync(0);
        }

        public async Task<int> PurgeExpiredScreenshotLogs30MinsAsync()
        {
            var sql = "DELETE FROM t_employee_screenshot_logs WHERE captured_at < ((now() at time zone 'utc') - INTERVAL '30 minutes');";
            return await _db.ExecuteAsync(sql);
        }

        public async Task<IEnumerable<EmployeeVideoLog>> GetExpiredVideoLogs30MinsAsync()
        {
            return await GetExpiredVideoLogsDynamicAsync(30);
        }

        public async Task<int> PurgeExpiredVideoLogs30MinsAsync()
        {
            var sql = "DELETE FROM t_employee_video_logs WHERE captured_at < ((now() at time zone 'utc') - INTERVAL '30 minutes');";
            return await _db.ExecuteAsync(sql);
        }
    }
}
