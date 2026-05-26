namespace Backend.Repositories;

using System.Threading.Tasks;
using Backend.Models;

public interface IAnalyticsRepository
{
    Task<ProductivityScore> GetProductivityAsync(int empId);
    Task<PayrollImpact> GetPayrollImpactAsync(int empId);
    Task<PerformanceGrade> GetPerformanceGradeAsync(int empId);
}
