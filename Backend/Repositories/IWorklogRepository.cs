namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface IWorklogRepository
{
    Task<int> CreateWorklogAsync(WorkLog log);
    Task<IEnumerable<WorkLogDetail>> GetWorklogsByEmpIdAsync(int empId);
    Task<bool> IsTaskAssignedToEmpAsync(int taskId, int empId);
    Task<IEnumerable<TaskProgress>> GetTaskProgressByEmpIdAsync(int empId);
    Task<IEnumerable<WorklogChartDto>> GetWorklogsChartAsync(int empId, string range);
    Task UpdateTaskStatusFromWorklogAsync(int taskId, string status);
}
