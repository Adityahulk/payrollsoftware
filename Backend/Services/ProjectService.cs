using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

namespace Backend.Services
{
    public interface IProjectService
    {
        Task<IEnumerable<Project>> GetProjectsAsync(int empId, int callerSpaceId, string callerRole);
        Task<IEnumerable<Project>> GetMyProjectsAsync(int empId);
        Task<Project?> GetProjectByIdAsync(int id, int callerSpaceId, string callerRole);
        Task<int> CreateProjectAsync(Project project, int callerEmpId, int callerSpaceId, string callerRole);
        Task<int> CreateProjectWithTasksAsync(CreateProjectWithTasksDto dto, int callerEmpId, int callerSpaceId, string callerRole);
        Task<bool> UpdateProjectAsync(int id, Project project, int callerEmpId, int callerSpaceId, string callerRole);
        Task<bool> DeleteProjectAsync(int id, int callerSpaceId, string callerRole);
        Task<IEnumerable<ProjectTask>> GetProjectTasksAsync(int id, int callerEmpId, int callerSpaceId, string callerRole);
        Task<int> CreateTaskAsync(ProjectTask task, int callerSpaceId, string callerRole);
        Task<bool> UpdateTaskAsync(int taskId, ProjectTask task, int callerSpaceId, string callerRole);
        Task<bool> UpdateTaskStatusAsync(int taskId, string status, int callerEmpId, int callerSpaceId, string callerRole);
        Task<IEnumerable<ProjectTask>> GetEmployeeTasksAsync(int empId, int callerEmpId, int callerSpaceId, string callerRole);
        Task<IEnumerable<ProjectTask>> GetMyTasksAsync(int empId);
        Task<IEnumerable<ProjectTask>> GetAllAssignedTasksAsync(int empId, string? search, int callerSpaceId, string callerRole);
        Task<IEnumerable<ProjectFile>> GetProjectFilesAsync(int projectId, int callerSpaceId, string callerRole);
        Task<int> AddProjectFileAsync(int projectId, string fileName, string filePath, int callerSpaceId, string callerRole);
        Task<bool> DeleteProjectFileAsync(int projectId, int fileId, int callerSpaceId, string callerRole);
    }

    public class ProjectService : IProjectService
    {
        private readonly IProjectRepository _projectRepo;
        private readonly IUserRepository _userRepo;
        private readonly ISpaceRepository _spaceRepo;
        private readonly INotificationService _notificationService;

        public ProjectService(
            IProjectRepository projectRepo, 
            IUserRepository userRepo, 
            ISpaceRepository spaceRepo, 
            INotificationService notificationService)
        {
            _projectRepo = projectRepo;
            _userRepo = userRepo;
            _spaceRepo = spaceRepo;
            _notificationService = notificationService;
        }

        private async Task<int?> ResolveAdminIdAsync(int empId, string role)
        {
            if (role == "Admin") return empId;

            var user = await _userRepo.GetUserByIdAsync(empId);
            if (user?.SpaceId != null)
            {
                var space = await _spaceRepo.GetSpaceByIdAsync(user.SpaceId.Value);
                if (space?.AdminId != null)
                {
                    return space.AdminId;
                }
            }

            var users = await _userRepo.GetAllUsersAsync();
            var admin = users.FirstOrDefault(u => u.Role == "Admin");
            return admin?.EmpId;
        }

        public async Task<IEnumerable<Project>> GetProjectsAsync(int empId, int callerSpaceId, string callerRole)
        {
            if (callerRole == "Admin")
            {
                return await _projectRepo.GetProjectsByAdminIdAsync(empId);
            }
            if (callerRole == "Manager")
            {
                var user = await _userRepo.GetUserByIdAsync(empId);
                if (user?.SpaceId != null)
                {
                    var space = await _spaceRepo.GetSpaceByIdAsync(user.SpaceId.Value);
                    if (space?.AdminId != null)
                    {
                        return await _projectRepo.GetProjectsByAdminIdAsync(space.AdminId.Value);
                    }
                }
                return await _projectRepo.GetAllProjectsAsync();
            }
            return await _projectRepo.GetProjectsByEmpIdAsync(empId);
        }

        public async Task<IEnumerable<Project>> GetMyProjectsAsync(int empId)
        {
            return await _projectRepo.GetProjectsByCreator(empId);
        }

        public async Task<Project?> GetProjectByIdAsync(int id, int callerSpaceId, string callerRole)
        {
            var project = await _projectRepo.GetProjectByIdAsync(id);
            if (project == null) return null;

            if (callerRole != "SuperAdmin" && project.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Project belongs to another department.");
            }
            return project;
        }

        public async Task<int> CreateProjectAsync(Project project, int callerEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Only Admins and TeamLeads can create projects.");
            }

            var user = await _userRepo.GetUserByIdAsync(callerEmpId);
            project.CreatedById = callerEmpId;
            project.SpaceId = callerSpaceId;
            project.AdminId = await ResolveAdminIdAsync(callerEmpId, callerRole);

            return await _projectRepo.CreateProjectAsync(project);
        }

        public async Task<int> CreateProjectWithTasksAsync(CreateProjectWithTasksDto dto, int callerEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Only Admins and TeamLeads can create projects.");
            }

            var adminId = await ResolveAdminIdAsync(callerEmpId, callerRole);
            var project = new Project
            {
                ProjectName = dto.ProjectName,
                Description = dto.Description,
                Links = dto.Links,
                DocumentationLinks = dto.DocumentationLinks,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                TeamId = dto.TeamId,
                CreatedById = callerEmpId,
                AdminId = adminId,
                SpaceId = callerSpaceId
            };

            var projectId = await _projectRepo.CreateProjectAsync(project);

            foreach (var t in dto.Tasks)
            {
                // Verify target employee space scope matches
                var targetUser = await _userRepo.GetUserByIdAsync(t.AssignedToEmpId);
                if (targetUser == null || targetUser.SpaceId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException($"Employee #{t.AssignedToEmpId} is outside your space scope.");
                }

                await _projectRepo.CreateTaskAsync(new ProjectTask
                {
                    ProjectId = projectId,
                    AssignedToEmpId = t.AssignedToEmpId,
                    TaskTitle = t.TaskTitle,
                    TaskDescription = t.TaskDescription ?? "",
                    TaskStatus = "Pending",
                    Priority = t.Priority ?? "Medium",
                    StartDate = t.StartDate,
                    DueDate = t.DueDate,
                    WorkingHours = t.WorkingHours ?? 8
                });
            }

            return projectId;
        }

        public async Task<bool> UpdateProjectAsync(int id, Project project, int callerEmpId, int callerSpaceId, string callerRole)
        {
            var existing = await _projectRepo.GetProjectByIdAsync(id);
            if (existing == null) return false;

            var callerAdminId = await ResolveAdminIdAsync(callerEmpId, callerRole);
            if (existing.AdminId != callerAdminId || existing.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot modify projects outside your space.");
            }

            project.ProjectId = id;
            project.CreatedById = existing.CreatedById;
            project.AdminId = existing.AdminId;
            project.SpaceId = callerSpaceId;

            return await _projectRepo.UpdateProjectAsync(project);
        }

        public async Task<bool> DeleteProjectAsync(int id, int callerSpaceId, string callerRole)
        {
            var existing = await _projectRepo.GetProjectByIdAsync(id);
            if (existing == null) return false;

            if (callerRole != "SuperAdmin" && existing.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot delete projects outside your space.");
            }

            return await _projectRepo.DeleteProjectAsync(id);
        }

        public async Task<IEnumerable<ProjectTask>> GetProjectTasksAsync(int id, int callerEmpId, int callerSpaceId, string callerRole)
        {
            var project = await _projectRepo.GetProjectByIdAsync(id);
            if (project == null)
            {
                return Enumerable.Empty<ProjectTask>();
            }

            if (callerRole != "SuperAdmin" && project.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot view tasks of another space's project.");
            }

            var tasks = await _projectRepo.GetTasksByProjectIdAsync(id);

            if (callerRole != "Admin" && callerRole != "TeamLead" && callerRole != "Manager")
            {
                tasks = tasks.Where(t => t.AssignedToEmpId == callerEmpId);
            }

            return tasks;
        }

        public async Task<int> CreateTaskAsync(ProjectTask task, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var project = await _projectRepo.GetProjectByIdAsync(task.ProjectId ?? 0);
            if (project == null || project.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot assign tasks to projects outside your space.");
            }

            var targetUser = await _userRepo.GetUserByIdAsync(task.AssignedToEmpId ?? 0);
            if (targetUser == null || targetUser.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot assign tasks to employees outside your space.");
            }

            if (string.IsNullOrWhiteSpace(task.TaskStatus)) task.TaskStatus = "Pending";
            if (string.IsNullOrWhiteSpace(task.Priority)) task.Priority = "Medium";

            return await _projectRepo.CreateTaskAsync(task);
        }

        public async Task<bool> UpdateTaskAsync(int taskId, ProjectTask task, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            var project = await _projectRepo.GetProjectByIdAsync(task.ProjectId ?? 0);
            if (project == null || project.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot assign tasks to projects outside your space.");
            }

            task.TaskId = taskId;
            return await _projectRepo.UpdateTaskAsync(task);
        }

        public async Task<bool> UpdateTaskStatusAsync(int taskId, string status, int callerEmpId, int callerSpaceId, string callerRole)
        {
            // Employees can update their own task status
            if (callerRole != "Admin" && callerRole != "TeamLead" && callerRole != "Manager")
            {
                var empTasks = await _projectRepo.GetTasksByEmployeeIdAsync(callerEmpId);
                if (!empTasks.Any(t => t.TaskId == taskId))
                {
                    throw new UnauthorizedAccessException("Cannot update status of a task not assigned to you.");
                }
            }

            var success = await _projectRepo.UpdateTaskStatusAsync(taskId, status);
            if (success && (status == "Completed" || status == "Complete" || status == "Resolve"))
            {
                var user = await _userRepo.GetUserByIdAsync(callerEmpId);
                if (user != null)
                {
                    var allEmpTasks = await _projectRepo.GetTasksByEmployeeIdAsync(callerEmpId);
                    var task = allEmpTasks.FirstOrDefault(t => t.TaskId == taskId);
                    var taskTitle = task?.TaskTitle ?? $"Task #{taskId}";
                    
                    await _notificationService.NotifyTaskCompletedAsync(callerEmpId, user.Email ?? "", user.SpaceId ?? 0, taskId, taskTitle);
                }
            }

            return success;
        }

        public async Task<IEnumerable<ProjectTask>> GetEmployeeTasksAsync(int empId, int callerEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager" && callerRole != "TeamLead" && callerEmpId != empId)
            {
                throw new UnauthorizedAccessException("Cannot view other employees' tasks.");
            }

            if (callerRole != "SuperAdmin")
            {
                var user = await _userRepo.GetUserByIdAsync(empId);
                if (user == null || user.SpaceId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("Requested employee is outside your space.");
                }
            }

            return await _projectRepo.GetTasksByEmployeeIdAsync(empId);
        }

        public async Task<IEnumerable<ProjectTask>> GetMyTasksAsync(int empId)
        {
            return await _projectRepo.GetTasksByEmployeeIdAsync(empId);
        }

        public async Task<IEnumerable<ProjectTask>> GetAllAssignedTasksAsync(int empId, string? search, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Access denied.");
            }

            IEnumerable<ProjectTask> tasks;
            if (!string.IsNullOrWhiteSpace(search))
            {
                tasks = await _projectRepo.SearchTasksByCreatorAsync(empId, search.Trim());
            }
            else
            {
                tasks = await _projectRepo.GetTasksByCreatorAsync(empId);
            }

            // Enforce space boundary
            if (callerRole != "SuperAdmin")
            {
                tasks = tasks.Where(t => t.AssignedToEmpId.HasValue && 
                    _userRepo.GetUserByIdAsync(t.AssignedToEmpId.Value).Result?.SpaceId == callerSpaceId);
            }

            return tasks;
        }

        public async Task<IEnumerable<ProjectFile>> GetProjectFilesAsync(int projectId, int callerSpaceId, string callerRole)
        {
            var project = await _projectRepo.GetProjectByIdAsync(projectId);
            if (project == null) throw new KeyNotFoundException("Project not found.");

            if (callerRole != "SuperAdmin" && project.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot access project files from another space.");
            }

            return await _projectRepo.GetProjectFilesAsync(projectId);
        }

        public async Task<int> AddProjectFileAsync(int projectId, string fileName, string filePath, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Only Admins and Team Leads can upload files.");
            }

            var project = await _projectRepo.GetProjectByIdAsync(projectId);
            if (project == null) throw new KeyNotFoundException("Project not found.");

            if (project.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot upload files to projects outside your space.");
            }

            var file = new ProjectFile
            {
                ProjectId = projectId,
                FileName = fileName,
                FilePath = filePath,
                UploadedAt = DateTime.UtcNow
            };

            return await _projectRepo.AddProjectFileAsync(file);
        }

        public async Task<bool> DeleteProjectFileAsync(int projectId, int fileId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Only Admins and Team Leads can delete files.");
            }

            var project = await _projectRepo.GetProjectByIdAsync(projectId);
            if (project == null) throw new KeyNotFoundException("Project not found.");

            if (project.SpaceId != callerSpaceId)
            {
                throw new UnauthorizedAccessException("Cannot delete files from projects outside your space.");
            }

            var file = await _projectRepo.GetProjectFileByIdAsync(fileId);
            if (file == null || file.ProjectId != projectId)
            {
                throw new KeyNotFoundException("File not found.");
            }

            return await _projectRepo.DeleteProjectFileAsync(fileId);
        }
    }
}
