using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;
using Backend.Repositories;

namespace Backend.Services
{
    public interface ILeaveService
    {
        Task<(bool success, string error)> ApplyLeaveAsync(LeaveRequest req, int empId, int spaceId);
        Task<IEnumerable<Leave>> GetMyLeavesAsync(int empId);
        Task<LeaveBalanceResponse> GetLeaveBalanceAsync(int empId, int callerEmpId, int callerSpaceId, string callerRole);
        Task<IEnumerable<dynamic>> GetAllLeavesAsync(int spaceId, string callerRole);
        Task<bool> UpdateLeaveStatusAsync(int leaveId, string status, int approvedByEmpId, int callerSpaceId, string callerRole);
        Task<SpaceLeaveConfig> GetSpaceLeaveConfigAsync(int targetSpaceId, int callerSpaceId, string callerRole);
        Task<bool> UpdateLeaveConfigAsync(int targetSpaceId, SpaceLeaveConfig config, int callerSpaceId, string callerRole);
    }

    public class LeaveService : ILeaveService
    {
        private readonly ILeaveRepository _leaveRepo;
        private readonly IUserRepository _userRepo;
        private readonly ISpaceRepository _spaceRepo;

        public LeaveService(ILeaveRepository leaveRepo, IUserRepository userRepo, ISpaceRepository spaceRepo)
        {
            _leaveRepo = leaveRepo;
            _userRepo = userRepo;
            _spaceRepo = spaceRepo;
        }

        public async Task<(bool success, string error)> ApplyLeaveAsync(LeaveRequest req, int empId, int spaceId)
        {
            if (!DateTime.TryParse(req.LeaveDate, out var leaveDate))
            {
                return (false, "Invalid date format. Use YYYY-MM-DD.");
            }

            var validTypes = new[] { "Normal", "Emergency", "College" };
            if (!Array.Exists(validTypes, t => t.Equals(req.LeaveType, StringComparison.OrdinalIgnoreCase)))
            {
                return (false, "Invalid leave type. Must be Normal, Emergency, or College.");
            }

            var leave = new Leave
            {
                EmpId = empId,
                SpaceId = spaceId,
                LeaveDate = leaveDate,
                Reason = req.Reason,
                LeaveType = req.LeaveType ?? "Normal",
                HalfDay = req.HalfDay
            };

            return await _leaveRepo.ApplyLeaveAsync(leave);
        }

        public async Task<IEnumerable<Leave>> GetMyLeavesAsync(int empId)
        {
            return await _leaveRepo.GetLeavesByEmpIdAsync(empId);
        }

        public async Task<LeaveBalanceResponse> GetLeaveBalanceAsync(int empId, int callerEmpId, int callerSpaceId, string callerRole)
        {
            // Security: employees can only view their own leave balance. Supervisors must be in the same spaceId
            if (callerRole == "Employee" && callerEmpId != empId)
            {
                throw new UnauthorizedAccessException("You can only check your own leave balance.");
            }

            if (callerRole != "SuperAdmin" && callerRole != "Admin")
            {
                var user = await _userRepo.GetUserByIdAsync(empId);
                if (user == null || user.SpaceId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("Employee is outside your department/space scope.");
                }
            }

            return await _leaveRepo.GetLeaveBalanceAsync(empId);
        }

        public async Task<IEnumerable<dynamic>> GetAllLeavesAsync(int spaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Access denied to leave requests.");
            }

            return await _leaveRepo.GetAllLeavesAsync(spaceId, callerRole);
        }

        public async Task<bool> UpdateLeaveStatusAsync(int leaveId, string status, int approvedByEmpId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager" && callerRole != "TeamLead")
            {
                throw new UnauthorizedAccessException("Access denied to modify leave status.");
            }

            var leave = await _leaveRepo.GetLeaveByIdAsync(leaveId);
            if (leave == null) return false;

            if (callerRole == "Admin")
            {
                var space = await _spaceRepo.GetSpaceByIdAsync(leave.SpaceId);
                if (space == null || space.AdminId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("You do not have access to approve/reject leaves for this space.");
                }
            }
            else
            {
                if (leave.SpaceId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("Cannot manage leaves for other spaces.");
                }
            }

            return await _leaveRepo.UpdateLeaveStatusAsync(leaveId, status, approvedByEmpId);
        }

        public async Task<SpaceLeaveConfig> GetSpaceLeaveConfigAsync(int targetSpaceId, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager")
            {
                throw new UnauthorizedAccessException("Access denied to space configurations.");
            }

            if (callerRole == "Admin")
            {
                var space = await _spaceRepo.GetSpaceByIdAsync(targetSpaceId);
                if (space == null || space.AdminId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("You do not have administrative access to this space's leave policy.");
                }
            }
            else
            {
                if (targetSpaceId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("Cannot view other spaces' leave policy.");
                }
            }

            return await _leaveRepo.GetSpaceLeaveConfigAsync(targetSpaceId);
        }

        public async Task<bool> UpdateLeaveConfigAsync(int targetSpaceId, SpaceLeaveConfig config, int callerSpaceId, string callerRole)
        {
            if (callerRole != "Admin" && callerRole != "Manager")
            {
                throw new UnauthorizedAccessException("Access denied to update space configurations.");
            }

            if (callerRole == "Admin")
            {
                var space = await _spaceRepo.GetSpaceByIdAsync(targetSpaceId);
                if (space == null || space.AdminId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("You do not have administrative access to this space's leave policy.");
                }
            }
            else
            {
                if (targetSpaceId != callerSpaceId || config.SpaceId != callerSpaceId)
                {
                    throw new UnauthorizedAccessException("Cannot update other spaces' leave policy.");
                }
            }

            if (config.EmergencyLeavesPerMonth < 0 || config.CollegeLeavesPerMonth < 0)
            {
                throw new ArgumentException("Leave limits cannot be negative.");
            }

            return await _leaveRepo.UpsertSpaceLeaveConfigAsync(config);
        }
    }
}
