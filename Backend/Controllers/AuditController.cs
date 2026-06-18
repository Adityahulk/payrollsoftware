using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;
using Backend.Services;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AuditController : ControllerBase
    {
        private readonly IAuditLogService _auditService;

        public AuditController(IAuditLogService auditService)
        {
            _auditService = auditService;
        }

        private int GetSpaceId()
        {
            var claim = User.FindFirst("SpaceId")?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        [HttpGet("space")]
        public async Task<IActionResult> GetAuditLogs()
        {
            var spaceId = GetSpaceId();
            if (spaceId == 0) return BadRequest(new { message = "User is not assigned to any space." });

            var logs = await _auditService.GetLogsBySpaceAsync(spaceId);
            return Ok(logs);
        }
    }
}
