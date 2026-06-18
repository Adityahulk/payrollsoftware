using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

namespace Backend.Services
{
    public interface IAttendanceService
    {
        Task<object> GetMyAttendanceAsync(int empId);
        Task<bool> ClockInAsync(int empId, string? ipAddress);
        Task<object> ClockOutAsync(int empId);
        Task<IEnumerable<Attendance>> GetAttendanceByUserIdAsync(int empId, int callerSpaceId, string callerRole);
        Task<IEnumerable<Attendance>> GetAttendanceBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole);
        Task<bool> StartBreakAsync(int empId);
        Task<bool> EndBreakAsync(int empId);
        Task<object> GetActiveBreakAsync(int empId);
        Task TestClearTodayAsync(int empId);
        Task<dynamic> GetTrendsAsync(int empId);
        Task<IEnumerable<Holiday>> GetHolidaysBySpaceIdAsync(int spaceId);
        Task<bool> AddHolidayAsync(Holiday holiday);
        Task<bool> DeleteHolidayAsync(int holidayId, int spaceId);
    }

    public class AttendanceService : IAttendanceService
    {
        private readonly IAttendanceRepository _attendanceRepo;
        private readonly IUserRepository _userRepo;
        private readonly IWfhService _wfhService;

        public AttendanceService(IAttendanceRepository attendanceRepo, IUserRepository userRepo, IWfhService wfhService)
        {
            _attendanceRepo = attendanceRepo;
            _userRepo = userRepo;
            _wfhService = wfhService;
        }

        public async Task<object> GetMyAttendanceAsync(int empId)
        {
            var attendance = await _attendanceRepo.GetAttendanceByUserIdAsync(empId);
            var dateOfJoining = await _attendanceRepo.GetDateOfJoiningAsync(empId);
            var workingDays = await _attendanceRepo.GetWorkingDaysByEmpIdAsync(empId);
            return new { attendance, dateOfJoining, workingDays };
        }

        public async Task<bool> ClockInAsync(int empId, string? ipAddress)
        {
            // Restrict login/clock-in by IP address (office network vs WFH override)
            bool ipAllowed = await _wfhService.IsIpAllowedAsync(empId, ipAddress);
            if (!ipAllowed)
            {
                throw new UnauthorizedAccessException("Clock-in restricted: You are not on the office network and do not have WFH approval for today.");
            }

            return await _attendanceRepo.ClockInAsync(empId);
        }

        public async Task<object> ClockOutAsync(int empId)
        {
            var records = await _attendanceRepo.GetAttendanceByUserIdAsync(empId);
            var activeRecord = records.FirstOrDefault(r => r.ClockIn.HasValue && !r.ClockOut.HasValue);
            
            if (activeRecord == null)
            {
                throw new InvalidOperationException("You have not clocked in yet or you already clocked out today!");
            }

            var clockOutTime = DateTime.Now;
            var clockInTime = activeRecord.ClockIn.Value;
            decimal totalHours = (decimal)(clockOutTime - clockInTime).TotalHours;

            var times = await _attendanceRepo.GetSpaceWorkTimesAsync(empId);
            int earlyExitMinutes = 0;

            // Check if today is a working day
            var workingDays = await _attendanceRepo.GetWorkingDaysByEmpIdAsync(empId);
            string todayName = Space.DayOfWeekToShortName(DateTime.Now.DayOfWeek);
            bool isWorkingDay = workingDays.Contains(todayName, StringComparer.OrdinalIgnoreCase);
            
            if (isWorkingDay && times.EndTime.HasValue)
            {
                var standardExitTime = clockOutTime.Date.Add(times.EndTime.Value);
                if (clockOutTime < standardExitTime)
                {
                    earlyExitMinutes = (int)(standardExitTime - clockOutTime).TotalMinutes;
                }
            }

            if (isWorkingDay && times.WorkingHours.HasValue)
            {
                int shortfall = (int)((times.WorkingHours.Value - (double)totalHours) * 60);
                if (shortfall > earlyExitMinutes)
                {
                    earlyExitMinutes = shortfall;
                }
            }

            var success = await _attendanceRepo.ClockOutAsync(activeRecord.AttendanceId, clockOutTime, totalHours, earlyExitMinutes);
            if (!success)
            {
                throw new Exception("Failed to update clock-out records in database.");
            }

            return new { Message = "Clocked out successfully!", TotalHours = totalHours, EarlyExitMinutes = earlyExitMinutes, ClockOut = clockOutTime };
        }

        public async Task<IEnumerable<Attendance>> GetAttendanceByUserIdAsync(int empId, int callerSpaceId, string callerRole)
        {
            // Security: check space ID matches
            if (callerRole != "SuperAdmin" && callerRole != "Admin")
            {
                var user = await _userRepo.GetUserByIdAsync(empId);
                if (user == null || user.SpaceId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("Employee is not in your space.");
                }
            }
            return await _attendanceRepo.GetAttendanceByUserIdAsync(empId);
        }

        public async Task<IEnumerable<Attendance>> GetAttendanceBySpaceIdAsync(int spaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }
            if (callerRole != "SuperAdmin" && spaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Access denied to other space records.");
            }
            return await _attendanceRepo.GetAttendanceBySpaceIdAsync(spaceId, 500);
        }

        public async Task<bool> StartBreakAsync(int empId)
        {
            return await _attendanceRepo.StartBreakAsync(empId);
        }

        public async Task<bool> EndBreakAsync(int empId)
        {
            return await _attendanceRepo.EndBreakAsync(empId);
        }

        public async Task<object> GetActiveBreakAsync(int empId)
        {
            var breakStart = await _attendanceRepo.GetActiveBreakStartAsync(empId);
            return new { isOnBreak = breakStart.HasValue, breakStart };
        }

        public async Task TestClearTodayAsync(int empId)
        {
            await _attendanceRepo.TestClearTodayAsync(empId);
        }

        public async Task<dynamic> GetTrendsAsync(int empId)
        {
            return await _attendanceRepo.GetTrendsAsync(empId);
        }

        public async Task<IEnumerable<Holiday>> GetHolidaysBySpaceIdAsync(int spaceId)
        {
            return await _attendanceRepo.GetHolidaysBySpaceIdAsync(spaceId);
        }

        public async Task<bool> AddHolidayAsync(Holiday holiday)
        {
            return await _attendanceRepo.AddHolidayAsync(holiday);
        }

        public async Task<bool> DeleteHolidayAsync(int holidayId, int spaceId)
        {
            return await _attendanceRepo.DeleteHolidayAsync(holidayId, spaceId);
        }
    }
}
