namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Linq;
using System;
using Backend.Models;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectController : ControllerBase
{
    private readonly IProjectRepository _projectRepository;
    private readonly IUserRepository _userRepository;
    private readonly ISpaceRepository _spaceRepository;
    private readonly Backend.Services.INotificationService _notificationService;

    public ProjectController(IProjectRepository projectRepository, IUserRepository userRepository, ISpaceRepository spaceRepository, Backend.Services.INotificationService notificationService)
    {
        _projectRepository = projectRepository;
        _userRepository = userRepository;
        _spaceRepository = spaceRepository;
        _notificationService = notificationService;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    private async Task<int?> ResolveAdminIdAsync(int empId, string role)
    {
        if (role == "Admin") return empId;

        var user = await _userRepository.GetUserByIdAsync(empId);
        if (user?.SpaceId != null)
        {
            var space = await _spaceRepository.GetSpaceByIdAsync(user.SpaceId.Value);
            if (space?.AdminId != null)
            {
                return space.AdminId;
            }
        }

        // Fallback: look for the first Admin in the system
        var users = await _userRepository.GetAllUsersAsync();
        var admin = users.FirstOrDefault(u => u.Role == "Admin");
        if (admin != null) return admin.EmpId;

        return null;
    }

    // ──────────────────────────────────────────────────────────────────────
    // GET /api/Project — Admin sees company projects via adminId; Manager/TL/Employee see relevant
    // ──────────────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetProjects()
    {
        var empId = GetEmpId();
        var role = GetRole();

        if (role is "Admin")
        {
            // Admin sees all projects linked to them via adminid
            var projects = await _projectRepository.GetProjectsByAdminIdAsync(empId);
            return Ok(projects);
        }

        if (role is "Manager")
        {
            // Manager sees all projects (readonly) — try via adminId lookup
            var user = await _userRepository.GetUserByIdAsync(empId);
            if (user?.SpaceId != null)
            {
                var space = await _spaceRepository.GetSpaceByIdAsync(user.SpaceId.Value);
                if (space?.AdminId != null)
                {
                    var projects = await _projectRepository.GetProjectsByAdminIdAsync(space.AdminId.Value);
                    return Ok(projects);
                }
            }
            var all = await _projectRepository.GetAllProjectsAsync();
            return Ok(all);
        }

        if (empId == 0) return Unauthorized();
        var empProjects = await _projectRepository.GetProjectsByEmpIdAsync(empId);
        return Ok(empProjects);
    }

    // ──────────────────────────────────────────────────────────────────────
    // GET /api/Project/my — Projects created by the logged-in TeamLead
    // ──────────────────────────────────────────────────────────────────────
    [HttpGet("my")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> GetMyProjects()
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized("EmpId missing in token");

        var projects = await _projectRepository.GetProjectsByCreator(empId);
        return Ok(projects);
    }

    // ──────────────────────────────────────────────────────────────────────
    // GET /api/Project/{id}
    // ──────────────────────────────────────────────────────────────────────
    [HttpGet("{id}")]
    public async Task<IActionResult> GetProjectById(int id)
    {
        var project = await _projectRepository.GetProjectByIdAsync(id);
        if (project == null) return NotFound();
        return Ok(project);
    }

    // ──────────────────────────────────────────────────────────────────────
    // POST /api/Project — Create project (auto-links adminId via space)
    // ──────────────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> CreateProject([FromBody] Project project)
    {
        var empId = GetEmpId();
        project.CreatedById = empId;

        // Resolve adminId and spaceId
        var user = await _userRepository.GetUserByIdAsync(empId);
        project.SpaceId = user?.SpaceId;
        project.AdminId = await ResolveAdminIdAsync(empId, GetRole());

        var projectId = await _projectRepository.CreateProjectAsync(project);
        return CreatedAtAction(nameof(GetProjectById), new { id = projectId }, new { projectId, project.ProjectName });
    }

    // ──────────────────────────────────────────────────────────────────────
    // POST /api/Project/create-with-tasks — Create project + tasks in one call
    // ──────────────────────────────────────────────────────────────────────
    [HttpPost("create-with-tasks")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> CreateProjectWithTasks([FromBody] CreateProjectWithTasksDto dto)
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.ProjectName))
            return BadRequest(new { message = "Project name is required." });

        // Resolve adminId and spaceId
        var user = await _userRepository.GetUserByIdAsync(empId);
        var role = GetRole();
        var adminId = await ResolveAdminIdAsync(empId, role);

        var projectId = await _projectRepository.CreateProjectAsync(new Project
        {
            ProjectName = dto.ProjectName,
            Description = dto.Description,
            Links = dto.Links,
            DocumentationLinks = dto.DocumentationLinks,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            TeamId = dto.TeamId,
            CreatedById = empId,
            AdminId = adminId,
            SpaceId = user?.SpaceId,
        });

        var createdTasks = new List<object>();
        foreach (var t in dto.Tasks)
        {
            var taskId = await _projectRepository.CreateTaskAsync(new ProjectTask
            {
                ProjectId = projectId,
                AssignedToEmpId = t.AssignedToEmpId,
                TaskTitle = t.TaskTitle,
                TaskDescription = t.TaskDescription ?? "",
                TaskStatus = "Pending",
                Priority = t.Priority ?? "Medium",
                StartDate = t.StartDate,
                DueDate = t.DueDate,
                WorkingHours = t.WorkingHours ?? 8,
            });
            createdTasks.Add(new { taskId, t.TaskTitle, t.AssignedToEmpId });
        }

        Console.WriteLine($"[create-with-tasks] Project #{projectId} created with {createdTasks.Count} tasks by EmpId={empId}, AdminId={adminId}");

        return Ok(new { projectId, projectName = dto.ProjectName, tasksCreated = createdTasks.Count, tasks = createdTasks });
    }

    // ──────────────────────────────────────────────────────────────────────
    // PUT /api/Project/{id}
    // ──────────────────────────────────────────────────────────────────────
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> UpdateProject(int id, [FromBody] Project project)
    {
        var empId = GetEmpId();
        var role = GetRole();

        var existing = await _projectRepository.GetProjectByIdAsync(id);
        if (existing == null) return NotFound(new { message = "Project not found." });

        var callerAdminId = await ResolveAdminIdAsync(empId, role);
        if (existing.AdminId != callerAdminId)
        {
            return Forbid();
        }

        project.ProjectId = id;
        project.CreatedById = existing.CreatedById;
        project.AdminId = existing.AdminId;
        if (!project.SpaceId.HasValue) project.SpaceId = existing.SpaceId;

        var success = await _projectRepository.UpdateProjectAsync(project);
        if (!success) return NotFound();
        return Ok(new { message = "Project updated successfully.", project });
    }

    // ──────────────────────────────────────────────────────────────────────
    // DELETE /api/Project/{id}
    // ──────────────────────────────────────────────────────────────────────
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> DeleteProject(int id)
    {
        var success = await _projectRepository.DeleteProjectAsync(id);
        if (!success) return NotFound();
        return Ok(new { message = "Project deleted" });
    }

    [HttpGet("{id}/tasks")]
    public async Task<IActionResult> GetProjectTasks(int id)
    {
        var empId = GetEmpId();
        var role = GetRole();
        var tasks = await _projectRepository.GetTasksByProjectIdAsync(id);

        if (role is not ("Admin" or "TeamLead" or "Manager"))
        {
            // Employees only see tasks assigned to themselves
            tasks = tasks.Where(t => t.AssignedToEmpId == empId);
        }
        return Ok(tasks);
    }

    // ──────────────────────────────────────────────────────────────────────
    // POST /api/Project/tasks — Assign a single task
    // ──────────────────────────────────────────────────────────────────────
    [HttpPost("tasks")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> CreateTask([FromBody] ProjectTask task)
    {
        if (string.IsNullOrWhiteSpace(task.TaskStatus)) task.TaskStatus = "Pending";
        if (string.IsNullOrWhiteSpace(task.Priority)) task.Priority = "Medium";
        var taskId = await _projectRepository.CreateTaskAsync(task);
        return Ok(new { TaskId = taskId });
    }

    // ──────────────────────────────────────────────────────────────────────
    // PUT /api/Project/tasks/{taskId}
    // ──────────────────────────────────────────────────────────────────────
    [HttpPut("tasks/{taskId}")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> UpdateTask(int taskId, [FromBody] ProjectTask task)
    {
        task.TaskId = taskId;
        var success = await _projectRepository.UpdateTaskAsync(task);
        if (!success) return NotFound();
        return Ok(new { message = "Task updated" });
    }

    // ──────────────────────────────────────────────────────────────────────
    // PATCH /api/Project/tasks/{taskId}/status
    // ──────────────────────────────────────────────────────────────────────
    [HttpPatch("tasks/{taskId}/status")]
    public async Task<IActionResult> UpdateTaskStatus(int taskId, [FromBody] UpdateStatusRequest req)
    {
        var empId = GetEmpId();
        var role = GetRole();

        // Employees can update their own task status
        if (role is not ("Admin" or "TeamLead" or "Manager"))
        {
            var empTasks = await _projectRepository.GetTasksByEmployeeIdAsync(empId);
            if (!empTasks.Any(t => t.TaskId == taskId))
                return Forbid();
        }

        var success = await _projectRepository.UpdateTaskStatusAsync(taskId, req.Status);
        if (!success) return NotFound();

        if (req.Status == "Completed" || req.Status == "Complete" || req.Status == "Resolve")
        {
            try
            {
                var user = await _userRepository.GetUserByIdAsync(empId);
                if (user != null)
                {
                    var allEmpTasks = await _projectRepository.GetTasksByEmployeeIdAsync(empId);
                    var task = allEmpTasks.FirstOrDefault(t => t.TaskId == taskId);
                    var taskTitle = task?.TaskTitle ?? $"Task #{taskId}";
                    
                    await _notificationService.NotifyTaskCompletedAsync(empId, user.Email ?? "", user.SpaceId ?? 0, taskId, taskTitle);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Notification Trigger Error] Task Completed: {ex.Message}");
            }
        }

        return Ok(new { message = "Status updated" });
    }

    // ──────────────────────────────────────────────────────────────────────
    // GET /api/Project/employee/{empid}/tasks
    // ──────────────────────────────────────────────────────────────────────
    [HttpGet("employee/{empid}/tasks")]
    public async Task<IActionResult> GetEmployeeTasks(int empid)
    {
        var callerEmpId = GetEmpId();
        var role = GetRole();

        if (role is not ("Admin" or "Manager" or "TeamLead") && callerEmpId != empid)
            return Forbid();

        var tasks = await _projectRepository.GetTasksByEmployeeIdAsync(empid);
        return Ok(tasks);
    }

    // ──────────────────────────────────────────────────────────────────────
    // GET /api/Project/my-tasks — Tasks assigned TO the logged-in user
    // ──────────────────────────────────────────────────────────────────────
    [HttpGet("my-tasks")]
    public async Task<IActionResult> GetMyTasks()
    {
        var empId = GetEmpId();
        Console.WriteLine($"[my-tasks] Logged in EmpId: {empId}");

        if (empId == 0) return Unauthorized();

        var tasks = await _projectRepository.GetTasksByEmployeeIdAsync(empId);
        Console.WriteLine($"[my-tasks] Tasks Count: {tasks.Count()}");

        return Ok(tasks);
    }

    // ──────────────────────────────────────────────────────────────────────
    // GET /api/Project/all-assigned-tasks?search= — Tasks from projects created by TL
    // ──────────────────────────────────────────────────────────────────────
    [HttpGet("all-assigned-tasks")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> GetAllAssignedTasks([FromQuery] string? search)
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();

        IEnumerable<ProjectTask> tasks;

        if (!string.IsNullOrWhiteSpace(search))
        {
            tasks = await _projectRepository.SearchTasksByCreatorAsync(empId, search.Trim());
        }
        else
        {
            tasks = await _projectRepository.GetTasksByCreatorAsync(empId);
        }

        Console.WriteLine($"[all-assigned-tasks] EmpId={empId}, Search='{search}', Count={tasks.Count()}");
        return Ok(tasks);
    }
}
