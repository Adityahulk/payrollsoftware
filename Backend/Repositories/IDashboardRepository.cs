namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface IDashboardRepository
{
    Task<IEnumerable<RecentWorklogDto>> GetRecentWorklogsAsync(int adminId, int days);
    Task<IEnumerable<RecentEmployeeDto>> GetRecentEmployeesAsync(int adminId, int days);
    Task<AdminSummaryDto> GetAdminSummaryAsync(int adminId);
}
