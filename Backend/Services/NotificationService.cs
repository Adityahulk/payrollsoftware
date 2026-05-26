using Backend.Models;
using Backend.Repositories;
using Backend.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using System;

namespace Backend.Services
{
    public interface INotificationService
    {
        Task NotifyRegisterAsync(int empId, string email, string role, int spaceId);
        Task NotifyClockInAsync(int empId, string email, int spaceId, DateTime clockInTime);
        Task NotifyLeaveAppliedAsync(int empId, string email, int spaceId, DateTime leaveDate, string reason);
        Task NotifyTaskCompletedAsync(int empId, string email, int spaceId, int taskId, string taskTitle);
        Task NotifyPasswordResetAsync(int empId, string email, int spaceId);
    }

    public class NotificationService : INotificationService
    {
        private readonly INoticeRepository _noticeRepo;
        private readonly IHubContext<NotificationHub> _hubContext;

        public NotificationService(INoticeRepository noticeRepo, IHubContext<NotificationHub> hubContext)
        {
            _noticeRepo = noticeRepo;
            _hubContext = hubContext;
        }

        public async Task NotifyRegisterAsync(int empId, string email, string role, int spaceId)
        {
            var text = $"New employee registered: {email} (ID: #{empId}) with role {role}.";
            // Register triggers Admin + Manager notification
            await CreateAndSendNotificationAsync(empId, spaceId, text, "Register", "Admin,Manager");
        }

        public async Task NotifyClockInAsync(int empId, string email, int spaceId, DateTime clockInTime)
        {
            var text = $"Employee {email} (ID: #{empId}) clocked in at {clockInTime.ToString("g")}.";
            // Clock In triggers Admin + Manager notification
            await CreateAndSendNotificationAsync(empId, spaceId, text, "ClockIn", "Admin,Manager");
        }

        public async Task NotifyLeaveAppliedAsync(int empId, string email, int spaceId, DateTime leaveDate, string reason)
        {
            var text = $"Employee {email} (ID: #{empId}) requested leave for {leaveDate.ToString("yyyy-MM-dd")}. Reason: {reason}";
            // Leave triggers Admin + Manager notification
            await CreateAndSendNotificationAsync(empId, spaceId, text, "Leave", "Admin,Manager");
        }

        public async Task NotifyTaskCompletedAsync(int empId, string email, int spaceId, int taskId, string taskTitle)
        {
            var text = $"Employee {email} (ID: #{empId}) completed Task #{taskId}: '{taskTitle}'.";
            // Task Completed triggers Admin + TL notification
            await CreateAndSendNotificationAsync(empId, spaceId, text, "TaskComplete", "Admin,TL");
        }

        public async Task NotifyPasswordResetAsync(int empId, string email, int spaceId)
        {
            var text = $"Password has been reset for employee {email} (ID: #{empId}).";
            await CreateAndSendNotificationAsync(empId, spaceId, text, "PasswordReset", "Employee");
        }

        private async Task CreateAndSendNotificationAsync(int empId, int spaceId, string text, string eventType, string targetRoles)
        {
            var notice = new Notice
            {
                AdminId = empId,
                SpaceId = spaceId > 0 ? spaceId : (int?)null,
                NoticeText = text,
                ToType = "Notification",
                CreatedAt = DateTime.UtcNow,
                EventType = eventType,
                TargetRole = targetRoles,
                IsReadAdmin = false,
                IsReadManager = false,
                IsReadTl = false,
                IsReadEmployee = false
            };

            // Save to DB
            var noticeId = await _noticeRepo.CreateNotificationAsync(notice);
            notice.NoticeId = noticeId;

            // Broadcast real-time push via SignalR to all clients. Clients filter dynamically.
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", notice);
        }
    }
}
