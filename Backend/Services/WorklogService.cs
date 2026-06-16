using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

namespace Backend.Services
{
    public interface IWorklogService
    {
        Task<int> CreateWorklogAsync(WorkLogRequest req, int empId);
        Task<IEnumerable<WorkLogDetail>> GetWorklogsByEmpIdAsync(int empId, int callerSpaceId, string callerRole);
        Task<IEnumerable<TaskProgress>> GetTaskProgressByEmpIdAsync(int empId, int callerSpaceId, string callerRole);
        Task<IEnumerable<WorklogChartDto>> GetWorklogsChartAsync(int empId, string range, int callerSpaceId, string callerRole);
        Task<IEnumerable<EmployeeDailyActivityDto>> GetEmployeeDailyActivityAsync(int empId, string range, int callerSpaceId, string callerRole);
    }

    public class WorklogService : IWorklogService
    {
        private readonly IWorklogRepository _worklogRepo;
        private readonly IUserRepository _userRepo;

        public WorklogService(IWorklogRepository worklogRepo, IUserRepository userRepo)
        {
            _worklogRepo = worklogRepo;
            _userRepo = userRepo;
        }

        private async Task ValidateAccessAsync(int targetEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole == "SuperAdmin") return;

            var target = await _userRepo.GetUserByIdAsync(targetEmpId);
            if (target == null) return;

            if (callerRole == "Admin")
            {
                if (targetEmpId == callerSpaceId) return;
                var isUnder = await _userRepo.IsUserUnderAdminAsync(targetEmpId, callerSpaceId);
                if (!isUnder)
                {
                    throw new UnauthorizedAccessException("Employee does not belong to your department scope.");
                }
                return;
            }

            if (target.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Employee does not belong to your department scope.");
            }
        }

        public async Task<int> CreateWorklogAsync(WorkLogRequest req, int empId)
        {
            // Validate: HoursWorked must be > 0 and <= 12
            if (req.HoursWorked <= 0m || req.HoursWorked > 12m)
            {
                throw new ArgumentException("Daily hours worked must be between 0.1 and 12.");
            }

            // Verify task is assigned to this employee
            bool isAssigned = await _worklogRepo.IsTaskAssignedToEmpAsync(req.TaskId, empId);
            if (!isAssigned)
            {
                throw new UnauthorizedAccessException("You are not assigned to this task, so you cannot log work against it.");
            }

            var log = new WorkLog
            {
                EmpId = empId,
                TaskId = req.TaskId,
                HoursWorked = req.HoursWorked,
                Description = req.Description ?? string.Empty,
                WorkDate = DateTime.Today
            };

            var logId = await _worklogRepo.CreateWorklogAsync(log);

            // Dynamically update task status if provided
            if (!string.IsNullOrEmpty(req.TaskStatus))
            {
                await _worklogRepo.UpdateTaskStatusFromWorklogAsync(req.TaskId, req.TaskStatus);
            }

            return logId;
        }

        public async Task<IEnumerable<WorkLogDetail>> GetWorklogsByEmpIdAsync(int empId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "SuperAdmin" && callerRole != "Admin" && callerRole != "Manager" && callerRole != "TeamLead" && callerRole != "Employee")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }
            await ValidateAccessAsync(empId, callerSpaceId, callerRole);
            return await _worklogRepo.GetWorklogsByEmpIdAsync(empId);
        }

        public async Task<IEnumerable<TaskProgress>> GetTaskProgressByEmpIdAsync(int empId, int callerSpaceId, string callerRole)
        {
            await ValidateAccessAsync(empId, callerSpaceId, callerRole);
            return await _worklogRepo.GetTaskProgressByEmpIdAsync(empId);
        }

        public async Task<IEnumerable<WorklogChartDto>> GetWorklogsChartAsync(int empId, string range, int callerSpaceId, string callerRole)
        {
            await ValidateAccessAsync(empId, callerSpaceId, callerRole);
            return await _worklogRepo.GetWorklogsChartAsync(empId, range);
        }

        public async Task<IEnumerable<EmployeeDailyActivityDto>> GetEmployeeDailyActivityAsync(int empId, string range, int callerSpaceId, string callerRole)
        {
            await ValidateAccessAsync(empId, callerSpaceId, callerRole);

            var today = DateTime.Today;
            var startDate = today;
            var endDate = today;

            // Normalize range parameter
            range = (range ?? "monthly").ToLower().Replace(" ", "");

            if (range == "weekly")
            {
                int diff = (7 + (today.DayOfWeek - DayOfWeek.Monday)) % 7;
                startDate = today.AddDays(-diff).Date;
                endDate = startDate.AddDays(6).Date;
            }
            else if (range == "6months")
            {
                startDate = new DateTime(today.Year, today.Month, 1).AddMonths(-5);
                endDate = new DateTime(today.Year, today.Month, 1).AddMonths(1).AddDays(-1);
            }
            else // default to monthly
            {
                startDate = new DateTime(today.Year, today.Month, 1);
                endDate = startDate.AddMonths(1).AddDays(-1);
            }

            // Fetch expected working hours
            decimal expectedHours = await _worklogRepo.GetExpectedWorkingHoursAsync(empId);

            // Fetch raw activity records
            var rawRecords = await _worklogRepo.GetEmployeeDailyActivityRawAsync(empId, startDate, endDate);

            // Fetch screenshots
            var screenshots = await _worklogRepo.GetEmployeeScreenshotsAsync(empId, startDate, endDate);

            // Map and group records
            var groupedActivity = new Dictionary<DateTime, EmployeeDailyActivityDto>();

            // Ensure we have a record for each day in the date range, even if there's no attendance or worklogs
            for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
            {
                groupedActivity[date] = new EmployeeDailyActivityDto
                {
                    EmpId = empId,
                    Date = date,
                    ClockIn = null,
                    ClockOut = null,
                    TotalHours = null,
                    MissingHours = expectedHours,
                    Worklogs = new List<WorklogItemDto>(),
                    Screenshots = new List<ScreenshotDto>()
                };
            }

            // Populate from raw query records
            foreach (var record in rawRecords)
            {
                var date = record.AttendanceDate.Date;
                if (!groupedActivity.ContainsKey(date))
                {
                    // Fallback in case of out of range dates returned
                    groupedActivity[date] = new EmployeeDailyActivityDto
                    {
                        EmpId = empId,
                        Date = date,
                        Worklogs = new List<WorklogItemDto>(),
                        Screenshots = new List<ScreenshotDto>()
                    };
                }

                var dto = groupedActivity[date];
                dto.ClockIn = record.ClockIn;
                dto.ClockOut = record.ClockOut;
                dto.TotalHours = record.TotalHours;
                dto.MissingHours = Math.Max(0m, expectedHours - (record.TotalHours ?? 0m));

                if (record.LogId.HasValue)
                {
                    // Prevent duplicate logs in case of multi-row mappings
                    if (!dto.Worklogs.Any(w => w.LogId == record.LogId.Value))
                    {
                        dto.Worklogs.Add(new WorklogItemDto
                        {
                            LogId = record.LogId.Value,
                            TaskId = record.TaskId ?? 0,
                            TaskName = record.TaskName ?? "Unknown Task",
                            HoursWorked = record.HoursWorked ?? 0m,
                            Description = record.Description ?? string.Empty
                        });
                    }
                }
            }

            // Populate screenshots
            foreach (var scr in screenshots)
            {
                var date = scr.CapturedAt.Date;
                if (groupedActivity.TryGetValue(date, out var dto))
                {
                    dto.Screenshots.Add(scr);
                }
            }

            // Sort the list descending by date
            return groupedActivity.Values.OrderByDescending(x => x.Date);
        }
    }
}
