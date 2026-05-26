namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Threading.Tasks;
using System;
using Backend.Models;
using Backend.Repositories;

[ApiController]
[Route("api/[controller]")]
[Route("api/worklogs")]
[Authorize]
public class WorklogController : ControllerBase
{
    private readonly IWorklogRepository _worklogRepo;
    private readonly IUserRepository _userRepository;
    private readonly IProjectRepository _projectRepository;
    private readonly Backend.Services.INotificationService _notificationService;

    public WorklogController(
        IWorklogRepository worklogRepo, 
        IUserRepository userRepository, 
        IProjectRepository projectRepository, 
        Backend.Services.INotificationService notificationService)
    {
        _worklogRepo = worklogRepo;
        _userRepository = userRepository;
        _projectRepository = projectRepository;
        _notificationService = notificationService;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    // POST /api/Worklog
    [HttpPost]
    public async Task<IActionResult> CreateWorklog([FromBody] WorkLogRequest request)
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized(new { message = "Invalid token." });

        if (request.HoursWorked < 0.5m || request.HoursWorked > 24)
            return BadRequest(new { message = "Hours worked must be between 0.5 and 24." });

        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new { message = "Description is required." });

        // Validate task assignment — skip if validation fails (task tables may vary)
        try
        {
            var assigned = await _worklogRepo.IsTaskAssignedToEmpAsync(request.TaskId, empId);
            if (!assigned)
                return BadRequest(new { message = "This task is not assigned to you." });
        }
        catch
        {
            // If table doesn't exist yet, skip the check
        }

        var log = new WorkLog
        {
            EmpId = empId,
            TaskId = request.TaskId,
            HoursWorked = request.HoursWorked,
            Description = request.Description,
            WorkDate = DateTime.UtcNow.Date
        };

        var logId = await _worklogRepo.CreateWorklogAsync(log);

        // Update task status from worklog
        if (!string.IsNullOrWhiteSpace(request.TaskStatus))
        {
            try
            {
                await _worklogRepo.UpdateTaskStatusFromWorklogAsync(request.TaskId, request.TaskStatus);

                if (request.TaskStatus == "Completed" || request.TaskStatus == "Complete" || request.TaskStatus == "Resolve")
                {
                    var user = await _userRepository.GetUserByIdAsync(empId);
                    if (user != null)
                    {
                        var allEmpTasks = await _projectRepository.GetTasksByEmployeeIdAsync(empId);
                        var task = allEmpTasks.FirstOrDefault(t => t.TaskId == request.TaskId);
                        var taskTitle = task?.TaskTitle ?? $"Task #{request.TaskId}";

                        await _notificationService.NotifyTaskCompletedAsync(empId, user.Email ?? "", user.SpaceId ?? 0, request.TaskId, taskTitle);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WorklogController] Failed to update task status from worklog or notify: {ex.Message}");
            }
        }

        return Ok(new { logId, message = "Work log saved." });
    }

    // GET /api/Worklog  (current user)
    [HttpGet]
    public async Task<IActionResult> GetMyWorklogs()
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();
        var logs = await _worklogRepo.GetWorklogsByEmpIdAsync(empId);
        return Ok(logs);
    }

    // GET /api/worklogs/me
    [HttpGet("me")]
    public async Task<IActionResult> GetMyWorklogsChart([FromQuery] string range)
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();
        var chartData = await _worklogRepo.GetWorklogsChartAsync(empId, range);
        return Ok(chartData);
    }

    // GET /api/Worklog/{empId}  (admin/TL access)
    [HttpGet("{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetWorklogsByEmpId(int empId)
    {
        var logs = await _worklogRepo.GetWorklogsByEmpIdAsync(empId);
        return Ok(logs);
    }

    // GET /api/Worklog/tasks
    [HttpGet("tasks")]
    public async Task<IActionResult> GetMyTaskProgress()
    {
        var empId = GetEmpId();
        if (empId == 0) return Unauthorized();
        var tasks = await _worklogRepo.GetTaskProgressByEmpIdAsync(empId);
        return Ok(new {
            success = true,
            data = tasks
        });
    }

    // GET /api/Worklog/tasks/{empId}
    [HttpGet("tasks/{empId:int}")]
    [Authorize(Roles = "Admin,Manager,TeamLead")]
    public async Task<IActionResult> GetTaskProgressByEmpId(int empId)
    {
        var tasks = await _worklogRepo.GetTaskProgressByEmpIdAsync(empId);
        return Ok(tasks);
    }
}
