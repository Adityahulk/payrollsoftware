namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface INoticeRepository
{
    Task<IEnumerable<Notice>> GetNoticesBySpaceIdAsync(int spaceId);
    Task<IEnumerable<Notice>> GetNoticesByEmployeeIdAsync(int empid);
    Task<int> CreateNoticeAsync(Notice notice);
    Task<bool> DeleteOldNoticesAsync();
    Task<IEnumerable<Notice>> GetQueriesAsync(int spaceId, int empId, string role);
    Task<bool> ReplyToQueryAsync(int noticeId, string reply, int repliedBy);
    Task<bool> SetQueryStatusAsync(int noticeId, string status);
    Task<bool> SoftDeleteQueryAsync(int noticeId);

    // Real-Time Notification Methods
    Task<int> CreateNotificationAsync(Notice notice);
    Task<IEnumerable<Notice>> GetNotificationsForRoleAsync(string role, int empId, int spaceId);
    Task<bool> MarkNotificationAsReadAsync(int noticeId, string role);
}
