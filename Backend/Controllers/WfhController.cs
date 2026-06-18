using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;
using System;
using Backend.Services;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WfhController : ControllerBase
    {
        private readonly IWfhService _wfhService;
        private readonly IAuditLogService _auditLog;

        public WfhController(IWfhService wfhService, IAuditLogService auditLog)
        {
            _wfhService = wfhService;
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
            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "";
            if (role == "Admin")
            {
                return GetEmpId();
            }
            var claim = User.FindFirst("SpaceId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        [HttpPost("grant")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GrantWfh([FromBody] GrantWfhRequest req)
        {
            var adminEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            
            try
            {
                var success = await _wfhService.GrantWfhAsync(req.EmpId, req.Date, spaceId);
                if (success)
                {
                    await _auditLog.LogActionAsync(adminEmpId, "Grant WFH", $"Granted WFH to Employee #{req.EmpId} for date {req.Date:yyyy-MM-dd}", Request.HttpContext.Connection.RemoteIpAddress?.ToString());
                    return Ok(new { message = "WFH permission granted successfully." });
                }
                return BadRequest(new { message = "WFH permission already exists for this date." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("revoke")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> RevokeWfh([FromBody] GrantWfhRequest req)
        {
            var adminEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            
            try
            {
                var success = await _wfhService.RevokeWfhAsync(req.EmpId, req.Date, spaceId);
                if (success)
                {
                    await _auditLog.LogActionAsync(adminEmpId, "Revoke WFH", $"Revoked WFH from Employee #{req.EmpId} for date {req.Date:yyyy-MM-dd}", Request.HttpContext.Connection.RemoteIpAddress?.ToString());
                    return Ok(new { message = "WFH permission revoked successfully." });
                }
                return NotFound(new { message = "WFH permission record not found." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("space")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetWfhPermissions()
        {
            var spaceId = GetSpaceId();
            var list = await _wfhService.GetWfhPermissionsBySpaceAsync(spaceId);
            return Ok(list);
        }
    }

    public class GrantWfhRequest
    {
        public int EmpId { get; set; }
        public DateTime Date { get; set; }
    }
}
