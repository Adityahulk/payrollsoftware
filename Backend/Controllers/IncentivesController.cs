namespace Backend.Controllers
{
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Authorization;
    using System.Security.Claims;
    using System.Threading.Tasks;
    using System;
    using Backend.Services;
    using Dapper;

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class IncentivesController : ControllerBase
    {
        private readonly IIncentiveService _incentiveService;
        private readonly System.Data.IDbConnection _db;

        public IncentivesController(IIncentiveService incentiveService, System.Data.IDbConnection db)
        {
            _incentiveService = incentiveService;
            _db = db;
        }

        private int GetEmpId()
        {
            var claim = User.FindFirst("EmpId")?.Value
                     ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        // POST /api/incentives/add
        [HttpPost("add")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> AddIncentive([FromBody] AddIncentiveRequest request)
        {
            try
            {
                if (request == null)
                    return BadRequest(new { message = "Invalid request payload." });

                if (request.EmpId <= 0)
                    return BadRequest(new { message = "Valid employee ID is required." });

                if (request.Amount <= 0)
                    return BadRequest(new { message = "Incentive amount must be greater than zero." });

                var addedBy = GetEmpId();
                if (addedBy == 0)
                    return Unauthorized(new { message = "User session is invalid." });

                // Fetch target employee's spaceid
                var spaceId = await _db.ExecuteScalarAsync<int?>("SELECT spaceid FROM t_users WHERE empid = @EmpId", new { EmpId = request.EmpId }) ?? 0;

                var monthVal = request.Month <= 0 ? DateTime.UtcNow.Month : request.Month;
                var yearVal = request.Year <= 0 ? DateTime.UtcNow.Year : request.Year;

                var id = await _incentiveService.AddIncentiveAsync(
                    request.EmpId,
                    spaceId,
                    addedBy,
                    request.Amount,
                    request.Type ?? "",
                    request.Reason ?? "",
                    monthVal,
                    yearVal);

                return Ok(new { message = "Incentive added successfully.", incentiveId = id });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[IncentivesController] Error adding incentive: {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while adding incentive.", error = ex.Message });
            }
        }

        // GET /api/incentives/employee/{empid}?month=&year=
        [HttpGet("employee/{empid:int}")]
        public async Task<IActionResult> GetEmployeeIncentives(int empid, [FromQuery] int? month, [FromQuery] int? year)
        {
            try
            {
                var incentives = await _incentiveService.GetEmployeeIncentivesAsync(empid, month, year);
                return Ok(incentives);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[IncentivesController] Error retrieving incentives for emp {empid}: {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while retrieving incentives.", error = ex.Message });
            }
        }

        // DELETE /api/incentives/{id}
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteIncentive(int id)
        {
            try
            {
                var deleted = await _incentiveService.DeleteIncentiveAsync(id);
                if (deleted)
                {
                    return Ok(new { message = "Incentive deleted successfully." });
                }
                return NotFound(new { message = "Incentive not found." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[IncentivesController] Error deleting incentive {id}: {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while deleting the incentive.", error = ex.Message });
            }
        }
    }

    public class AddIncentiveRequest
    {
        public int EmpId { get; set; }
        public decimal Amount { get; set; }
        public string? Type { get; set; }
        public string? Reason { get; set; }
        public int Month { get; set; }
        public int Year { get; set; }
    }
}
