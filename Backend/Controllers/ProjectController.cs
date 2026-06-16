namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using System;
using Backend.Models;
using Backend.Services;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectController : ControllerBase
{
    private readonly IProjectService _projectService;

    public ProjectController(IProjectService projectService)
    {
        _projectService = projectService;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private int GetSpaceId()
    {
        var claim = User.FindFirst("SpaceId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    // GET /api/project
    [HttpGet]
    public async Task<IActionResult> GetProjects()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var spaceId = GetSpaceId();
            var role = GetRole();

            var projects = await _projectService.GetProjectsAsync(empId, spaceId, role);
            return Ok(projects);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch projects.", details = ex.Message });
        }
    }

    // GET /api/project/my
    [HttpGet("my")]
    public async Task<IActionResult> GetMyProjects()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var projects = await _projectService.GetMyProjectsAsync(empId);
            return Ok(projects);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch your projects.", details = ex.Message });
        }
    }

    // GET /api/project/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetProjectById(int id)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var project = await _projectService.GetProjectByIdAsync(id, spaceId, role);
            if (project == null) return NotFound(new { message = "Project not found." });
            return Ok(project);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch project.", details = ex.Message });
        }
    }

    // POST /api/project
    [HttpPost]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> CreateProject([FromBody] Project project)
    {
        try
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            if (project == null) return BadRequest("Project details are required.");

            var projectId = await _projectService.CreateProjectAsync(project, empId, spaceId, role);
            project.ProjectId = projectId;
            return CreatedAtAction(nameof(GetProjectById), new { id = projectId }, project);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create project.", details = ex.Message });
        }
    }

    // POST /api/project/with-tasks
    [HttpPost("with-tasks")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> CreateProjectWithTasks([FromBody] CreateProjectWithTasksDto dto)
    {
        try
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            if (dto == null) return BadRequest("Project and task data is required.");

            var projectId = await _projectService.CreateProjectWithTasksAsync(dto, empId, spaceId, role);
            return Ok(new { message = "Project and tasks created successfully.", projectId });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create project with tasks.", details = ex.Message });
        }
    }

    // PUT /api/project/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> UpdateProject(int id, [FromBody] Project project)
    {
        try
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            if (project == null) return BadRequest("Project details are required.");

            var success = await _projectService.UpdateProjectAsync(id, project, empId, spaceId, role);
            if (!success) return NotFound(new { message = "Project not found." });

            return Ok(new { message = "Project updated successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to update project.", details = ex.Message });
        }
    }

    // DELETE /api/project/{id}
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteProject(int id)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var success = await _projectService.DeleteProjectAsync(id, spaceId, role);
            if (!success) return NotFound(new { message = "Project not found." });

            return Ok(new { message = "Project deleted successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to delete project.", details = ex.Message });
        }
    }

    // GET /api/project/{id}/tasks
    [HttpGet("{id:int}/tasks")]
    public async Task<IActionResult> GetProjectTasks(int id)
    {
        try
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            var tasks = await _projectService.GetProjectTasksAsync(id, empId, spaceId, role);
            return Ok(tasks);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch project tasks.", details = ex.Message });
        }
    }

    // POST /api/project/tasks
    [HttpPost("tasks")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> CreateTask([FromBody] ProjectTask task)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            if (task == null) return BadRequest("Task details are required.");

            var taskId = await _projectService.CreateTaskAsync(task, spaceId, role);
            task.TaskId = taskId;
            return Ok(new { message = "Task created successfully.", taskId });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create task.", details = ex.Message });
        }
    }

    // PUT /api/project/tasks/{taskId}
    [HttpPut("tasks/{taskId:int}")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> UpdateTask(int taskId, [FromBody] ProjectTask task)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            if (task == null) return BadRequest("Task details are required.");

            var success = await _projectService.UpdateTaskAsync(taskId, task, spaceId, role);
            if (!success) return NotFound(new { message = "Task not found." });

            return Ok(new { message = "Task updated successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to update task.", details = ex.Message });
        }
    }

    // PUT /api/project/tasks/status/{taskId}
    [HttpPut("tasks/status/{taskId:int}")]
    public async Task<IActionResult> UpdateTaskStatus(int taskId, [FromBody] UpdateTaskStatusRequest req)
    {
        try
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            if (req == null || string.IsNullOrWhiteSpace(req.Status))
                return BadRequest("Task status is required.");

            var success = await _projectService.UpdateTaskStatusAsync(taskId, req.Status, empId, spaceId, role);
            if (!success) return NotFound(new { message = "Task not found." });

            return Ok(new { message = "Task status updated successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to update task status.", details = ex.Message });
        }
    }

    // GET /api/project/tasks/employee/{empId}
    [HttpGet("tasks/employee/{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetEmployeeTasks(int empId)
    {
        try
        {
            var callerEmpId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            var tasks = await _projectService.GetEmployeeTasksAsync(empId, callerEmpId, spaceId, role);
            return Ok(tasks);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch employee tasks.", details = ex.Message });
        }
    }

    // GET /api/project/tasks/my
    [HttpGet("tasks/my")]
    public async Task<IActionResult> GetMyTasks()
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var tasks = await _projectService.GetMyTasksAsync(empId);
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch your tasks.", details = ex.Message });
        }
    }

    // GET /api/project/tasks/assigned
    [HttpGet("tasks/assigned")]
    [Authorize(Roles = "Admin,TeamLead")]
    public async Task<IActionResult> GetAllAssignedTasks([FromQuery] string? search = null)
    {
        try
        {
            var empId = GetEmpId();
            var spaceId = GetSpaceId();
            var role = GetRole();

            var tasks = await _projectService.GetAllAssignedTasksAsync(empId, search, spaceId, role);
            return Ok(tasks);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch assigned tasks.", details = ex.Message });
        }
    }
}

public class UpdateTaskStatusRequest
{
    public string Status { get; set; } = string.Empty;
}
