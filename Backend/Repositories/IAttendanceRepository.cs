namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface IAttendanceRepository
{
    Task<IEnumerable<Attendance>> GetAttendanceByUserIdAsync(int empid);
    Task<bool> ClockInAsync(int empId);
    Task<bool> ClockOutAsync(int attendanceId, DateTime clockOut, decimal totalHours, int earlyExitMinutes);
    Task<IEnumerable<Attendance>> GetAllAttendanceAsync();
    Task<IEnumerable<Attendance>> GetAttendanceBySpaceIdAsync(int spaceId, int? limitRows = 500);
    Task<bool> StartBreakAsync(int empId);
    Task<bool> EndBreakAsync(int empId);
    Task<DateTime?> GetActiveBreakStartAsync(int empId);
    Task<DateTime> GetDateOfJoiningAsync(int empId);
    Task<(TimeSpan? StartTime, TimeSpan? EndTime, int? WorkingHours)> GetSpaceWorkTimesAsync(int empId);
    Task TestClearTodayAsync(int empId);
    Task<dynamic> GetTrendsAsync(int empId);
    Task<List<string>> GetWorkingDaysByEmpIdAsync(int empId);
    Task<IEnumerable<Holiday>> GetHolidaysBySpaceIdAsync(int spaceId);
    Task<bool> AddHolidayAsync(Holiday holiday);
    Task<bool> DeleteHolidayAsync(int holidayId, int spaceId);
}
