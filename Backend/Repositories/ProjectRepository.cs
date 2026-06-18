namespace Backend.Repositories;

using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class ProjectRepository : IProjectRepository
{
    private readonly IDbConnection _dbConnection;

    public ProjectRepository(IDbConnection dbConnection)
    {
        _dbConnection = dbConnection;
    }

    // ── Project Queries ──────────────────────────────────────────────────────

    public async Task<IEnumerable<Project>> GetAllProjectsAsync()
    {
        var query = @"
            SELECT projectid, createdbyid, adminid, spaceid, projectname, description, 
                   array_to_json(links)::text AS LinksRaw, 
                   array_to_json(documentationlinks)::text AS DocLinksRaw, 
                   startdate::timestamp AS startdate, enddate::timestamp AS enddate, teamid, createdat 
            FROM t_projects 
            ORDER BY projectid DESC";
        return await _dbConnection.QueryAsync<Project>(query);
    }

    public async Task<IEnumerable<Project>> GetProjectsByCreator(int empId)
    {
        var sql = @"
            SELECT projectid, createdbyid, adminid, spaceid, projectname, description, 
                   array_to_json(links)::text AS LinksRaw, 
                   array_to_json(documentationlinks)::text AS DocLinksRaw, 
                   startdate::timestamp AS startdate, enddate::timestamp AS enddate, teamid, createdat
            FROM t_projects
            WHERE createdbyid = @EmpId
            ORDER BY createdat DESC";
        return await _dbConnection.QueryAsync<Project>(sql, new { EmpId = empId });
    }

    // Admin sees all projects in their company (linked via adminid)
    public async Task<IEnumerable<Project>> GetProjectsByAdminIdAsync(int adminId)
    {
        var sql = @"
            SELECT projectid, createdbyid, adminid, spaceid, projectname, description, 
                   array_to_json(links)::text AS LinksRaw, 
                   array_to_json(documentationlinks)::text AS DocLinksRaw, 
                   startdate::timestamp AS startdate, enddate::timestamp AS enddate, teamid, createdat
            FROM t_projects
            WHERE adminid = @AdminId
            ORDER BY createdat DESC";
        return await _dbConnection.QueryAsync<Project>(sql, new { AdminId = adminId });
    }

    public async Task<IEnumerable<Project>> GetProjectsByEmpIdAsync(int empId)
    {
        var query = @"
            SELECT projectid, createdbyid, adminid, spaceid, projectname, description, 
                   array_to_json(links)::text AS LinksRaw, 
                   array_to_json(documentationlinks)::text AS DocLinksRaw, 
                   startdate::timestamp AS startdate, enddate::timestamp AS enddate, teamid, createdat
            FROM t_projects
            WHERE adminid = COALESCE(
                (SELECT s.adminid FROM t_users u INNER JOIN t_spaces s ON u.spaceid = s.spaceid WHERE u.empid = @EmpId LIMIT 1),
                (SELECT adminid FROM t_spaces WHERE adminid = @EmpId LIMIT 1),
                @EmpId
            )
            ORDER BY projectid DESC";
        return await _dbConnection.QueryAsync<Project>(query, new { EmpId = empId });
    }

    public async Task<Project?> GetProjectByIdAsync(int projectId)
    {
        var query = @"
            SELECT projectid, createdbyid, adminid, spaceid, projectname, description, 
                   array_to_json(links)::text AS LinksRaw, 
                   array_to_json(documentationlinks)::text AS DocLinksRaw, 
                   startdate::timestamp AS startdate, enddate::timestamp AS enddate, teamid, createdat 
            FROM t_projects 
            WHERE projectid = @ProjectId";
        return await _dbConnection.QueryFirstOrDefaultAsync<Project>(query, new { ProjectId = projectId });
    }

    public async Task<int> CreateProjectAsync(Project project)
    {
        var query = @"
            INSERT INTO t_projects (projectname, description, links, documentationlinks, startdate, enddate, teamid, createdbyid, adminid, spaceid, createdat) 
            VALUES (@ProjectName, @Description, 
                    ARRAY(SELECT json_array_elements_text(COALESCE(NULLIF(@LinksRaw, ''), '[]')::json)), 
                    ARRAY(SELECT json_array_elements_text(COALESCE(NULLIF(@DocLinksRaw, ''), '[]')::json)), 
                    @StartDate, @EndDate, @TeamId, @CreatedById, @AdminId, @SpaceId, NOW()) 
            RETURNING projectid;";
        return await _dbConnection.ExecuteScalarAsync<int>(query, project);
    }

    public async Task<bool> UpdateProjectAsync(Project project)
    {
        var query = @"
            UPDATE t_projects 
            SET projectname = @ProjectName, description = @Description, 
                links = ARRAY(SELECT json_array_elements_text(COALESCE(NULLIF(@LinksRaw, ''), '[]')::json)), 
                documentationlinks = ARRAY(SELECT json_array_elements_text(COALESCE(NULLIF(@DocLinksRaw, ''), '[]')::json)), 
                startdate = @StartDate, enddate = @EndDate, teamid = @TeamId, spaceid = @SpaceId
            WHERE projectid = @ProjectId";
        var result = await _dbConnection.ExecuteAsync(query, project);
        return result > 0;
    }

    public async Task<bool> DeleteProjectAsync(int projectId)
    {
        var query = "DELETE FROM t_projects WHERE projectid = @ProjectId";
        var result = await _dbConnection.ExecuteAsync(query, new { ProjectId = projectId });
        return result > 0;
    }

    // ── Task Queries ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<ProjectTask>> GetTasksByProjectIdAsync(int projectId)
    {
        var query = @"
            SELECT 
                t.taskid, t.projectid, t.assignedtoempid,
                t.tasktitle, t.taskdescription,
                CASE 
                    WHEN t.taskstatus IN ('Completed', 'Complete', 'Resolve') THEN t.taskstatus
                    WHEN COALESCE((SELECT SUM(w.hoursworked) FROM t_worklogs w WHERE w.taskid = t.taskid), 0) >= COALESCE(t.estimatedhours, 8) THEN 'Complete'
                    ELSE t.taskstatus
                END AS taskstatus,
                t.priority,
                t.startdate::timestamp AS startdate,
                t.duedate::timestamp AS duedate,
                t.completedat, t.createdat, t.workinghours, t.estimatedhours,
                p.projectname
            FROM t_projecttasks t
            JOIN t_projects p ON p.projectid = t.projectid
            WHERE t.projectid = @ProjectId
            ORDER BY t.createdat DESC";
        return await _dbConnection.QueryAsync<ProjectTask>(query, new { ProjectId = projectId });
    }

    public async Task<IEnumerable<ProjectTask>> GetTasksByEmployeeIdAsync(int empid)
    {
        var query = @"
            SELECT 
                t.taskid, t.projectid, t.assignedtoempid,
                t.tasktitle, t.taskdescription,
                CASE 
                    WHEN t.taskstatus IN ('Completed', 'Complete', 'Resolve') THEN t.taskstatus
                    WHEN COALESCE((SELECT SUM(w.hoursworked) FROM t_worklogs w WHERE w.taskid = t.taskid), 0) >= COALESCE(t.estimatedhours, 8) THEN 'Complete'
                    ELSE t.taskstatus
                END AS taskstatus,
                t.priority,
                t.startdate::timestamp AS startdate,
                t.duedate::timestamp AS duedate,
                t.completedat, t.createdat, t.workinghours, t.estimatedhours,
                p.projectname
            FROM t_projecttasks t
            JOIN t_projects p ON p.projectid = t.projectid
            WHERE t.assignedtoempid = @EmpId
            ORDER BY t.createdat DESC";
        return await _dbConnection.QueryAsync<ProjectTask>(query, new { EmpId = empid });
    }

    // All tasks from projects created by this TL — powers "All Assigned Tasks" tab
    public async Task<IEnumerable<ProjectTask>> GetTasksByCreatorAsync(int empId)
    {
        var query = @"
            SELECT 
                t.taskid, t.projectid, t.assignedtoempid,
                t.tasktitle, t.taskdescription,
                CASE 
                    WHEN t.taskstatus IN ('Completed', 'Complete', 'Resolve') THEN t.taskstatus
                    WHEN COALESCE((SELECT SUM(w.hoursworked) FROM t_worklogs w WHERE w.taskid = t.taskid), 0) >= COALESCE(t.estimatedhours, 8) THEN 'Complete'
                    ELSE t.taskstatus
                END AS taskstatus,
                t.priority,
                t.startdate::timestamp AS startdate,
                t.duedate::timestamp AS duedate,
                t.completedat, t.createdat, t.workinghours, t.estimatedhours,
                p.projectname
            FROM t_projecttasks t
            JOIN t_projects p ON p.projectid = t.projectid
            WHERE p.createdbyid = @EmpId
            ORDER BY t.createdat DESC";
        return await _dbConnection.QueryAsync<ProjectTask>(query, new { EmpId = empId });
    }

    // Search tasks from TL's projects by task title or project name
    public async Task<IEnumerable<ProjectTask>> SearchTasksByCreatorAsync(int empId, string search)
    {
        var query = @"
            SELECT 
                t.taskid, t.projectid, t.assignedtoempid,
                t.tasktitle, t.taskdescription,
                CASE 
                    WHEN t.taskstatus IN ('Completed', 'Complete', 'Resolve') THEN t.taskstatus
                    WHEN COALESCE((SELECT SUM(w.hoursworked) FROM t_worklogs w WHERE w.taskid = t.taskid), 0) >= COALESCE(t.estimatedhours, 8) THEN 'Complete'
                    ELSE t.taskstatus
                END AS taskstatus,
                t.priority,
                t.startdate::timestamp AS startdate,
                t.duedate::timestamp AS duedate,
                t.completedat, t.createdat, t.workinghours, t.estimatedhours,
                p.projectname
            FROM t_projecttasks t
            JOIN t_projects p ON p.projectid = t.projectid
            WHERE p.createdbyid = @EmpId
            AND (
                LOWER(t.tasktitle) LIKE LOWER(@Search)
                OR LOWER(p.projectname) LIKE LOWER(@Search)
            )
            ORDER BY t.createdat DESC";
        return await _dbConnection.QueryAsync<ProjectTask>(query, new { EmpId = empId, Search = $"%{search}%" });
    }

    public async Task<int> CreateTaskAsync(ProjectTask task)
    {
        var query = @"
            INSERT INTO t_projecttasks 
                (projectid, assignedtoempid, tasktitle, taskdescription, taskstatus, priority, startdate, duedate, workinghours, estimatedhours, createdat) 
            VALUES 
                (@ProjectId, @AssignedToEmpId, @TaskTitle, @TaskDescription, @TaskStatus, @Priority, @StartDate, @DueDate, COALESCE(@WorkingHours, 8), COALESCE(@EstimatedHours, @WorkingHours, 8), NOW()) 
            RETURNING taskid;";
        return await _dbConnection.ExecuteScalarAsync<int>(query, task);
    }

    public async Task<bool> UpdateTaskAsync(ProjectTask task)
    {
        var query = @"
            UPDATE t_projecttasks 
            SET assignedtoempid = @AssignedToEmpId, tasktitle = @TaskTitle, 
                taskdescription = @TaskDescription, taskstatus = @TaskStatus,
                priority = @Priority, startdate = @StartDate, duedate = @DueDate,
                workinghours = @WorkingHours, estimatedhours = COALESCE(@EstimatedHours, @WorkingHours),
                completedat = CASE WHEN @TaskStatus IN ('Completed', 'Complete', 'Resolve') THEN NOW() ELSE completedat END
            WHERE taskid = @TaskId";
        var result = await _dbConnection.ExecuteAsync(query, task);
        return result > 0;
    }

    public async Task<bool> UpdateTaskStatusAsync(int taskId, string status)
    {
        var query = @"
            UPDATE t_projecttasks 
            SET taskstatus = @Status,
                completedat = CASE WHEN @Status IN ('Completed', 'Complete', 'Resolve') THEN NOW() ELSE NULL END
            WHERE taskid = @TaskId";
        var result = await _dbConnection.ExecuteAsync(query, new { Status = status, TaskId = taskId });
        return result > 0;
    }

    public async Task<IEnumerable<ProjectFile>> GetProjectFilesAsync(int projectId)
    {
        var sql = "SELECT fileid, projectid, filename, filepath, uploadedat FROM t_project_files WHERE projectid = @ProjectId ORDER BY uploadedat DESC;";
        return await _dbConnection.QueryAsync<ProjectFile>(sql, new { ProjectId = projectId });
    }

    public async Task<int> AddProjectFileAsync(ProjectFile file)
    {
        var sql = "INSERT INTO t_project_files (projectid, filename, filepath, uploadedat) VALUES (@ProjectId, @FileName, @FilePath, NOW()) RETURNING fileid;";
        return await _dbConnection.ExecuteScalarAsync<int>(sql, file);
    }

    public async Task<ProjectFile?> GetProjectFileByIdAsync(int fileId)
    {
        var sql = "SELECT fileid, projectid, filename, filepath, uploadedat FROM t_project_files WHERE fileid = @FileId;";
        return await _dbConnection.QueryFirstOrDefaultAsync<ProjectFile>(sql, new { FileId = fileId });
    }

    public async Task<bool> DeleteProjectFileAsync(int fileId)
    {
        var sql = "DELETE FROM t_project_files WHERE fileid = @FileId;";
        var result = await _dbConnection.ExecuteAsync(sql, new { FileId = fileId });
        return result > 0;
    }
}
