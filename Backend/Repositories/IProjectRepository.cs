namespace Backend.Repositories;

using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface IProjectRepository
{
    Task<IEnumerable<Project>> GetAllProjectsAsync();
    Task<IEnumerable<Project>> GetProjectsByEmpIdAsync(int empId);
    Task<IEnumerable<Project>> GetProjectsByCreator(int empId);
    Task<IEnumerable<Project>> GetProjectsByAdminIdAsync(int adminId);
    Task<Project?> GetProjectByIdAsync(int projectId);
    Task<int> CreateProjectAsync(Project project);
    Task<bool> UpdateProjectAsync(Project project);
    Task<bool> DeleteProjectAsync(int projectId);
    
    Task<IEnumerable<ProjectFile>> GetProjectFilesAsync(int projectId);
    Task<int> AddProjectFileAsync(ProjectFile file);
    Task<ProjectFile?> GetProjectFileByIdAsync(int fileId);
    Task<bool> DeleteProjectFileAsync(int fileId);

    Task<IEnumerable<ProjectTask>> GetTasksByProjectIdAsync(int projectId);
    Task<IEnumerable<ProjectTask>> GetTasksByEmployeeIdAsync(int empid);
    Task<IEnumerable<ProjectTask>> GetTasksByCreatorAsync(int empId);
    Task<IEnumerable<ProjectTask>> SearchTasksByCreatorAsync(int empId, string search);
    Task<int> CreateTaskAsync(ProjectTask task);
    Task<bool> UpdateTaskAsync(ProjectTask task);
    Task<bool> UpdateTaskStatusAsync(int taskId, string status);
}
