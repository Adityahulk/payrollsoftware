using Microsoft.Extensions.Hosting;
using System.Threading;
using System.Threading.Tasks;
using System;
using Microsoft.Extensions.DependencyInjection;
using Backend.Repositories;
using Microsoft.AspNetCore.SignalR;
using Backend.Hubs;

namespace Backend.Services
{
    public class MonthEndHostedService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;

        public MonthEndHostedService(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.Today;
                var isLastDayOfMonth = now.Day == DateTime.DaysInMonth(now.Year, now.Month);

                if (isLastDayOfMonth)
                {
                    Console.WriteLine($"[MonthEndHostedService] Triggering month-end automation for {now:MMMM yyyy}...");
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        try
                        {
                            var noticeRepository = scope.ServiceProvider.GetRequiredService<INoticeRepository>();
                            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();
                            
                            // 1. Create notice and broadcast via SignalR
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
                            
                            var noticeId = await noticeRepository.CreateNotificationAsync(notice);
                            notice.NoticeId = noticeId;
                            await hubContext.Clients.All.SendAsync("ReceiveNotification", notice);

                            // 2. Create System Task "Monthly Payroll Check"
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
                            await noticeRepository.CreateNotificationAsync(taskNotice);

                            Console.WriteLine("[MonthEndHostedService] Successfully dispatched month-end tasks and alerts.");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[MonthEndHostedService] Error processing daily check: {ex.Message}");
                        }
                    }
                }

                // Check again in 24 hours
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
        }
    }
}
