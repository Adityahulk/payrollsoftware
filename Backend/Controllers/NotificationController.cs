using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System;
using Backend.Repositories;
using System.Security.Claims;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly INoticeRepository _noticeRepository;

        public NotificationController(INoticeRepository noticeRepository)
        {
            _noticeRepository = noticeRepository;
        }

        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] string? role, [FromQuery] int? empId, [FromQuery] int? spaceId)
        {
            // Resolve from token claims if not provided in query string
            var userRole = role ?? User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee";
            
            var rawEmpId = User.FindFirst("EmpId")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int resolvedEmpId = empId ?? (int.TryParse(rawEmpId, out int parsedEmpId) ? parsedEmpId : 0);

            var rawSpaceId = User.FindFirst("SpaceId")?.Value;
            int resolvedSpaceId = spaceId ?? (int.TryParse(rawSpaceId, out int parsedSpaceId) ? parsedSpaceId : 0);

            var notifications = await _noticeRepository.GetNotificationsForRoleAsync(userRole, resolvedEmpId, resolvedSpaceId);
            return Ok(notifications);
        }

        [HttpPut("mark-read/{id}")]
        public async Task<IActionResult> MarkAsRead(int id, [FromQuery] string? role)
        {
            var userRole = role ?? User.FindFirst(ClaimTypes.Role)?.Value ?? "Employee";
            var success = await _noticeRepository.MarkNotificationAsReadAsync(id, userRole);
            if (success)
            {
                return Ok(new { success = true, message = "Notification marked as read." });
            }
            return NotFound(new { success = false, message = "Notification not found or update failed." });
        }
    }
}
