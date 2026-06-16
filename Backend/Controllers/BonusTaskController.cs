using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Services;
using ClosedXML.Excel;
using System.IO;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BonusTaskController : ControllerBase
    {
        private readonly IBonusTaskService _bonusService;
        private readonly IAuditLogService _auditLog;

        public BonusTaskController(IBonusTaskService bonusService, IAuditLogService auditLog)
        {
            _bonusService = bonusService;
            _auditLog = auditLog;
        }

        private int GetEmpId()
        {
            var claim = User.FindFirst("EmpId")?.Value
                     ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        private int GetSpaceId()
        {
            var claim = User.FindFirst("SpaceId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateBonusTask([FromBody] BonusTask task)
        {
            var adminEmpId = GetEmpId();
            var spaceId = GetSpaceId();

            if (task.BonusAmount <= 0)
            {
                return BadRequest(new { message = "Bonus amount must be positive." });
            }

            try
            {
                var taskId = await _bonusService.CreateBonusTaskAsync(task, spaceId);
                await _auditLog.LogActionAsync(adminEmpId, "Create Bonus Task", $"Created bonus task '{task.Title}' with amount {task.BonusAmount}", Request.HttpContext.Connection.RemoteIpAddress?.ToString());
                return Ok(new { message = "Bonus task created successfully.", taskId });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("assign")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AssignBonusTask([FromBody] AssignBonusTaskRequest req)
        {
            var adminEmpId = GetEmpId();
            var spaceId = GetSpaceId();

            try
            {
                var success = await _bonusService.AssignBonusTaskAsync(req.TaskId, req.EmpId, spaceId);
                if (success)
                {
                    await _auditLog.LogActionAsync(adminEmpId, "Assign Bonus Task", $"Assigned task #{req.TaskId} to Employee #{req.EmpId}", Request.HttpContext.Connection.RemoteIpAddress?.ToString());
                    return Ok(new { message = "Bonus task assigned successfully." });
                }
                return BadRequest(new { message = "Failed to assign bonus task." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("complete/{taskId:int}")]
        public async Task<IActionResult> CompleteBonusTask(int taskId)
        {
            var empId = GetEmpId();

            try
            {
                var success = await _bonusService.CompleteBonusTaskAsync(taskId, empId);
                if (success)
                {
                    await _auditLog.LogActionAsync(empId, "Complete Bonus Task", $"Completed bonus task #{taskId}", Request.HttpContext.Connection.RemoteIpAddress?.ToString());
                    return Ok(new { message = "Bonus task marked as completed successfully." });
                }
                return BadRequest(new { message = "Task not found, already completed, or not assigned to you." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("space")]
        [Authorize(Roles = "Admin,Manager,TeamLead")]
        public async Task<IActionResult> GetSpaceBonusTasks()
        {
            var spaceId = GetSpaceId();
            var list = await _bonusService.GetBonusTasksBySpaceAsync(spaceId);
            return Ok(list);
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMyBonusTasks()
        {
            var empId = GetEmpId();
            var list = await _bonusService.GetMyBonusTasksAsync(empId);
            return Ok(list);
        }

        [HttpGet("report")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ExportBonusReport([FromServices] System.Data.IDbConnection db)
        {
            var spaceId = GetSpaceId();
            var sql = @"
                SELECT b.taskid, b.title, b.bonus_amount AS bonusamount, b.status, b.completed_at AS completedat, u.name, u.email
                FROM t_bonus_tasks b
                LEFT JOIN t_users u ON b.assigned_to = u.empid
                WHERE b.spaceid = @SpaceId
                ORDER BY b.taskid DESC;";
            
            var records = await Dapper.SqlMapper.QueryAsync(db, sql, new { SpaceId = spaceId });

            using (var workbook = new XLWorkbook())
            {
                var worksheet = workbook.Worksheets.Add("Bonus Tasks");

                worksheet.Cell(1, 1).Value = $"Work Intensity Bonus Report - Space #{spaceId}";
                worksheet.Cell(1, 1).Style.Font.Bold = true;
                worksheet.Cell(1, 1).Style.Font.FontSize = 14;
                worksheet.Range(1, 1, 1, 6).Merge();

                string[] headers = { "Task ID", "Task Title", "Bonus Amount", "Assignee Name", "Assignee Email", "Status" };
                for (int i = 0; i < headers.Length; i++)
                {
                    var cell = worksheet.Cell(3, i + 1);
                    cell.Value = headers[i];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#6366F1");
                    cell.Style.Font.FontColor = XLColor.White;
                }

                int rowIdx = 4;
                foreach (var rec in records)
                {
                    worksheet.Cell(rowIdx, 1).Value = rec.taskid;
                    worksheet.Cell(rowIdx, 2).Value = rec.title ?? "";
                    worksheet.Cell(rowIdx, 3).Value = (decimal)rec.bonusamount;
                    worksheet.Cell(rowIdx, 3).Style.NumberFormat.Format = "₹#,##0.00";
                    worksheet.Cell(rowIdx, 4).Value = rec.name ?? "Unassigned";
                    worksheet.Cell(rowIdx, 5).Value = rec.email ?? "";
                    worksheet.Cell(rowIdx, 6).Value = rec.status ?? "";
                    rowIdx++;
                }

                worksheet.Columns().AdjustToContents();

                using (var stream = new MemoryStream())
                {
                    workbook.SaveAs(stream);
                    var bytes = stream.ToArray();
                    return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Bonus_Report_Space_{spaceId}.xlsx");
                }
            }
        }
    }

    public class AssignBonusTaskRequest
    {
        public int TaskId { get; set; }
        public int EmpId { get; set; }
    }
}
