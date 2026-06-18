namespace Backend.Controllers
{
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Authorization;
    using System;
    using System.Threading.Tasks;
    using System.Collections.Generic;
    using Backend.Services;
    using Backend.Models;

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PerformanceController : ControllerBase
    {
        private readonly IPerformanceService _performanceService;

        public PerformanceController(IPerformanceService performanceService)
        {
            _performanceService = performanceService;
        }

        // GET /api/performance/{empid}?month=&year=
        [HttpGet("{empid:int}")]
        public async Task<IActionResult> GetEmployeePerformance(int empid, [FromQuery] int month = 0, [FromQuery] int year = 0)
        {
            try
            {
                var monthVal = month <= 0 ? DateTime.UtcNow.Month : month;
                var yearVal = year <= 0 ? DateTime.UtcNow.Year : year;

                var performance = await _performanceService.GetOrCreatePerformanceAsync(empid, monthVal, yearVal);
                return Ok(performance);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PerformanceController] Error retrieving performance for employee {empid}: {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while retrieving employee performance.", error = ex.Message });
            }
        }

        // GET /api/performance/space/{spaceid}?month=&year=
        [HttpGet("space/{spaceid:int}")]
        public async Task<IActionResult> GetSpacePerformance(int spaceid, [FromQuery] int month = 0, [FromQuery] int year = 0)
        {
            try
            {
                var monthVal = month <= 0 ? DateTime.UtcNow.Month : month;
                var yearVal = year <= 0 ? DateTime.UtcNow.Year : year;

                var records = await _performanceService.GetSpacePerformanceAsync(spaceid, monthVal, yearVal);
                return Ok(records);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PerformanceController] Error retrieving performance for space {spaceid}: {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while retrieving space performance.", error = ex.Message });
            }
        }
    }
}
