namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NoticeController : ControllerBase
{
    private readonly INoticeRepository _noticeRepository;

    public NoticeController(INoticeRepository noticeRepository)
    {
        _noticeRepository = noticeRepository;
    }

    [HttpGet("space/{spaceId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetNoticesBySpaceId(int spaceId)
    {
        var notices = await _noticeRepository.GetNoticesBySpaceIdAsync(spaceId);
        return Ok(notices);
    }

    [HttpGet("employee/{empid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetNoticesByEmployeeId(int empid)
    {
        var notices = await _noticeRepository.GetNoticesByEmployeeIdAsync(empid);
        return Ok(notices);
    }

    [HttpPost]
    public async Task<IActionResult> CreateNotice([FromBody] Notice notice)
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var spaceIdClaim = User.FindFirst("SpaceId")?.Value;

        if (int.TryParse(empIdClaim, out int empId))
        {
            notice.AdminId = empId;
        }
        if (int.TryParse(spaceIdClaim, out int spaceId))
        {
            notice.SpaceId = spaceId;
        }

        notice.CreatedAt = DateTime.UtcNow;
        var noticeId = await _noticeRepository.CreateNoticeAsync(notice);
        return Ok(new { NoticeId = noticeId });
    }

    [HttpDelete("cleanup")]
    public async Task<IActionResult> CleanupOldNotices()
    {
        var result = await _noticeRepository.DeleteOldNoticesAsync();
        return Ok(new { Success = result, Message = "Old notices cleaned up successfully." });
    }

    [HttpGet("queries")]
    public async Task<IActionResult> GetQueries()
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var spaceIdClaim = User.FindFirst("SpaceId")?.Value;
        var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee";

        if (!int.TryParse(empIdClaim, out int empId) || !int.TryParse(spaceIdClaim, out int spaceId))
        {
            return Unauthorized(new { message = "Invalid token claims" });
        }

        var queries = await _noticeRepository.GetQueriesAsync(spaceId, empId, roleClaim);
        return Ok(queries);
    }

    public class ReplyRequest
    {
        public required string Reply { get; set; }
    }

    [HttpPost("reply/{noticeId}")]
    public async Task<IActionResult> ReplyToQuery(int noticeId, [FromBody] ReplyRequest request)
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(empIdClaim, out int empId))
        {
            return Unauthorized(new { message = "Invalid token claims" });
        }

        var success = await _noticeRepository.ReplyToQueryAsync(noticeId, request.Reply, empId);
        if (success)
        {
            return Ok(new { Message = "Reply submitted successfully." });
        }
        return BadRequest(new { Message = "Failed to submit reply or query not found." });
    }

    public class StatusRequest
    {
        public required string Status { get; set; }
    }

    [HttpPut("status/{noticeId}")]
    public async Task<IActionResult> SetQueryStatus(int noticeId, [FromBody] StatusRequest request)
    {
        var success = await _noticeRepository.SetQueryStatusAsync(noticeId, request.Status);
        if (success)
        {
            return Ok(new { Message = "Query status updated successfully." });
        }
        return BadRequest(new { Message = "Failed to update query status." });
    }

    [HttpDelete("query/{noticeId}")]
    public async Task<IActionResult> DeleteQuery(int noticeId)
    {
        var success = await _noticeRepository.SoftDeleteQueryAsync(noticeId);
        if (success)
        {
            return Ok(new { Message = "Query soft deleted successfully." });
        }
        return BadRequest(new { Message = "Failed to delete query." });
    }
}
