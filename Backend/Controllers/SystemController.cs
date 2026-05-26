using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System;
using Backend.Repositories;
using Microsoft.AspNetCore.SignalR;
using Backend.Hubs;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class SystemController : ControllerBase
    {
        private readonly INoticeRepository _noticeRepository;
        private readonly IHubContext<NotificationHub> _hubContext;

        public SystemController(INoticeRepository noticeRepository, IHubContext<NotificationHub> hubContext)
        {
            _noticeRepository = noticeRepository;
            _hubContext = hubContext;
        }

        [HttpPost("run-month-end")]
        public async Task<IActionResult> RunMonthEnd()
        {
            try
            {
                var text = "Payroll cycle is due. Please review and process salaries.";
                var notice = new Models.Notice
                {
                    AdminId = 1,
                    SpaceId = null,
                    NoticeText = text,
                    ToType = "Notification",
                    CreatedAt = DateTime.UtcNow,
                    EventType = "MonthEndPayrollAlert",
                    TargetRole = "Admin",
                    IsReadAdmin = false
                };
                
                var noticeId = await _noticeRepository.CreateNotificationAsync(notice);
                notice.NoticeId = noticeId;
                await _hubContext.Clients.All.SendAsync("ReceiveNotification", notice);

                var taskText = "System Task: Monthly Payroll Check. Includes: 1. Verify attendance, 2. Verify worklogs, 3. Verify leave deductions, 4. Process salary.";
                var taskNotice = new Models.Notice
                {
                    AdminId = 1,
                    SpaceId = null,
                    NoticeText = taskText,
                    ToType = "Notice",
                    CreatedAt = DateTime.UtcNow,
                    EventType = "SystemTask",
                    TargetRole = "Admin",
                    IsReadAdmin = false
                };
                await _noticeRepository.CreateNotificationAsync(taskNotice);

                return Ok(new { message = "Month-end automation triggered successfully, alerts broadcasted, and system tasks initialized." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SystemController.RunMonthEnd] Error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to run month-end automation." });
            }
        }
    }
}
