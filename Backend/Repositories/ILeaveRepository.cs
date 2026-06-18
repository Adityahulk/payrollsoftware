namespace Backend.Repositories;
using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

public interface ILeaveRepository
{
    // Employee actions
    Task<(bool success, string error)> ApplyLeaveAsync(Leave leave);
    Task<IEnumerable<Leave>> GetLeavesByEmpIdAsync(int empId);
    Task<LeaveBalanceResponse> GetLeaveBalanceAsync(int empId);

    // Admin / Manager / TL actions
    Task<IEnumerable<dynamic>> GetAllLeavesAsync(int? spaceId, string role);
    Task<bool> UpdateLeaveStatusAsync(int leaveId, string status, int approvedByEmpId);
    Task<Leave?> GetLeaveByIdAsync(int leaveId);

    // Space leave policy (Admin/Manager configures)
    Task<SpaceLeaveConfig> GetSpaceLeaveConfigAsync(int spaceId);
    Task<bool> UpsertSpaceLeaveConfigAsync(SpaceLeaveConfig config);
}
