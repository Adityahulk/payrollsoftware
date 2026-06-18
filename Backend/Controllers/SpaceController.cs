namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using Backend.Models;
using Backend.Services;
using System.Security.Claims;

[ApiController]
[Route("api/spaces")]
public class SpaceController : ControllerBase
{
    private readonly ISpaceService _spaceService;
    private readonly IUserService _userService;
    private readonly ISalaryService _salaryService;
    private readonly IConfiguration _configuration;

    public SpaceController(
        ISpaceService spaceService, 
        IUserService userService, 
        ISalaryService salaryService,
        IConfiguration configuration)
    {
        _spaceService = spaceService;
        _userService = userService;
        _salaryService = salaryService;
        _configuration = configuration;
    }

    private int GetEmpId()
    {
        var claim = User.FindFirst("EmpId")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private int GetSpaceId()
    {
        var role = GetRole();
        if (role == "Admin")
        {
            return GetEmpId();
        }
        var claim = User.FindFirst("SpaceId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private string GetRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    [HttpGet]
    public async Task<IActionResult> GetAllSpaces()
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();
            var spaces = await _spaceService.GetAllSpacesAsync(spaceId, role);
            return Ok(spaces);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch spaces.", details = ex.Message });
        }
    }

    [HttpGet("my")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetMySpaces()
    {
        try
        {
            var adminId = GetEmpId();
            if (adminId == 0)
                return Unauthorized(new { message = "Invalid admin session." });

            var spaceId = GetSpaceId();
            var role = GetRole();

            var spaces = await _spaceService.GetSpacesByAdminIdAsync(adminId, spaceId, role);
            var result = spaces.Select(s => new {
                spaceid = s.SpaceId,
                spacename = s.SpaceName
            });
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch admin workspaces.", details = ex.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetSpaceById(int id)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var space = await _spaceService.GetSpaceByIdAsync(id, spaceId, role);
            if (space == null) return NotFound(new { message = "Space not found." });
            return Ok(space);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch space details.", details = ex.Message });
        }
    }

    // GET /api/spaces/admin/{adminId} -> returns all spaces of admin
    [HttpGet("admin/{adminId:int}")]
    public async Task<IActionResult> GetSpacesByAdmin(int adminId)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var spaces = await _spaceService.GetSpacesByAdminIdAsync(adminId, spaceId, role);
            return Ok(spaces);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch spaces for admin.", details = ex.Message });
        }
    }

    // GET /api/spaces/{spaceId}/employees -> employees of one space
    [HttpGet("{spaceId:int}/employees")]
    public async Task<IActionResult> GetEmployeesBySpace(int spaceId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var employees = await _userService.GetUsersBySpaceIdAsync(spaceId, callerSpaceId, role);
            return Ok(employees);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch employees of the space.", details = ex.Message });
        }
    }

    // GET /api/spaces/admin/{adminId}/employees -> ALL employees under admin
    [HttpGet("admin/{adminId:int}/employees")]
    public async Task<IActionResult> GetAllEmployeesByAdmin(int adminId)
    {
        try
        {
            var spaceId = GetSpaceId();
            var role = GetRole();

            var employees = await _userService.GetUsersByCompanyAsync(adminId, spaceId, role);
            return Ok(employees);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch company employees.", details = ex.Message });
        }
    }

    // POST /api/spaces/create
    [HttpPost("create")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSpace([FromBody] Space space)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0)
                return Unauthorized(new { message = "Invalid admin session." });

            var role = GetRole();

            space.AdminId = empId; // adminid must always be empid
            space.CreatedAt = DateTime.UtcNow;
            space.IsActive = true;

            if (string.IsNullOrEmpty(space.Type)) space.Type = "Department";
            if (!space.NumberOfEmployees.HasValue) space.NumberOfEmployees = 100;
            if (!space.NumberOfBreaks.HasValue) space.NumberOfBreaks = 2;
            if (!space.BreakTime.HasValue) space.BreakTime = 60;
            if (!space.WorkStartTime.HasValue) space.WorkStartTime = TimeOnly.Parse("09:00:00");
            if (!space.WorkEndTime.HasValue) space.WorkEndTime = TimeOnly.Parse("18:00:00");
            if (!space.WorkingHours.HasValue) space.WorkingHours = 8;

            var wdList = space.WorkingDaysList;
            if (wdList == null || wdList.Count == 0)
            {
                return BadRequest(new { message = "Working days list cannot be empty." });
            }
            if (wdList.Count > 7)
                return BadRequest(new { message = "Working days cannot exceed 7." });

            var validDays = new HashSet<string> { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
            foreach (var d in wdList)
            {
                if (!validDays.Contains(d))
                    return BadRequest(new { message = $"Invalid working day: '{d}'. Allowed values: Sun, Mon, Tue, Wed, Thu, Fri, Sat." });
            }

            var spaceId = await _spaceService.CreateSpaceAsync(space, role);
            space.SpaceId = spaceId;
            return CreatedAtAction(nameof(GetSpaceById), new { id = spaceId }, space);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create space.", details = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSpaceLegacy([FromBody] Space space)
    {
        return await CreateSpace(space);
    }

    // PUT /api/spaces/update/{spaceId}
    [HttpPut("update/{spaceId:int}")]
    [Authorize]
    public async Task<IActionResult> UpdateSpace(int spaceId, [FromBody] Space spacePayload)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0)
                return Unauthorized(new { message = "Invalid employee session." });

            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var existingSpace = await _spaceService.GetSpaceByIdAsync(spaceId, callerSpaceId, role);
            if (existingSpace == null)
                return NotFound(new { message = "Space not found." });

            // Payload binding
            existingSpace.SpaceName = spacePayload.SpaceName;
            
            if (spacePayload.NumberOfEmployees.HasValue)
                existingSpace.NumberOfEmployees = spacePayload.NumberOfEmployees.Value;

            if (spacePayload.NumberOfBreaks.HasValue)
                existingSpace.NumberOfBreaks = spacePayload.NumberOfBreaks.Value;

            if (spacePayload.BreakTime.HasValue)
                existingSpace.BreakTime = spacePayload.BreakTime.Value;

            if (spacePayload.WorkStartTime.HasValue)
                existingSpace.WorkStartTime = spacePayload.WorkStartTime.Value;

            if (spacePayload.WorkEndTime.HasValue)
                existingSpace.WorkEndTime = spacePayload.WorkEndTime.Value;

            if (spacePayload.WorkingHours.HasValue)
                existingSpace.WorkingHours = spacePayload.WorkingHours.Value;

            if (!string.IsNullOrEmpty(spacePayload.Type))
                existingSpace.Type = spacePayload.Type;

            if (spacePayload.EndDate.HasValue)
                existingSpace.EndDate = spacePayload.EndDate.Value;

            var wdPayload = spacePayload.WorkingDaysList;
            if (wdPayload != null)
            {
                if (wdPayload.Count == 0)
                    return BadRequest(new { message = "Working days list cannot be empty." });

                var validDaysSet = new HashSet<string> { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
                if (wdPayload.Count > 7)
                    return BadRequest(new { message = "Working days cannot exceed 7." });
                foreach (var d in wdPayload)
                {
                    if (!validDaysSet.Contains(d))
                        return BadRequest(new { message = $"Invalid working day: '{d}'." });
                }
                existingSpace.WorkingDaysList = wdPayload;
            }

            var result = await _spaceService.UpdateSpaceAsync(existingSpace, callerSpaceId, role);
            if (!result)
                return BadRequest(new { message = "Failed to update space." });

            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to update space.", details = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> UpdateSpaceLegacy(int id, [FromBody] Space spacePayload)
    {
        return await UpdateSpace(id, spacePayload);
    }

    // DELETE /api/spaces/delete/{id}
    [HttpDelete("delete/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSpace(int id)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var result = await _spaceService.DeleteSpaceAsync(id, callerSpaceId, role);
            if (!result) return NotFound(new { message = "Space not found." });
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to delete space.", details = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSpaceLegacy(int id)
    {
        return await DeleteSpace(id);
    }

    // --- CONTRACT ENDPOINTS ---

    [HttpGet("admin/{adminId:int}/contracts")]
    public async Task<IActionResult> GetContractsByAdmin(int adminId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var contracts = await _spaceService.GetContractsByAdminIdAsync(adminId, callerSpaceId, role);
            return Ok(contracts);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch contracts.", details = ex.Message });
        }
    }

    [HttpGet("admin/{adminId:int}/departments")]
    public async Task<IActionResult> GetDepartmentsByAdmin(int adminId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var departments = await _spaceService.GetDepartmentsByAdminIdAsync(adminId, callerSpaceId, role);
            return Ok(departments);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch departments.", details = ex.Message });
        }
    }

    [HttpGet("contract/{spaceId:int}/payment")]
    public async Task<IActionResult> GetContractPayment(int spaceId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var payment = await _spaceService.GetPaymentBySpaceIdAsync(spaceId, callerSpaceId, role);
            if (payment == null)
            {
                return Ok(new {
                    PaymentId = 0,
                    SpaceId = spaceId,
                    Amount = 50000m,
                    PaymentMethod = "UPI",
                    Status = "Pending",
                    TransactionId = "",
                    PaidAt = (DateTime?)null,
                    CreatedAt = DateTime.UtcNow
                });
            }
            return Ok(payment);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch contract payments.", details = ex.Message });
        }
    }

    [HttpPost("contract/{spaceId:int}/pay")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PayContract(int spaceId, [FromBody] ContractPayment paymentPayload)
    {
        try
        {
            var empId = GetEmpId();
            if (empId == 0) return Unauthorized();

            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var existingPayment = await _spaceService.GetPaymentBySpaceIdAsync(spaceId, callerSpaceId, role);
            int paymentId = 0;
            
            if (existingPayment == null)
            {
                paymentPayload.SpaceId = spaceId;
                paymentPayload.Status = "Paid";
                paymentPayload.PaidAt = DateTime.UtcNow;
                paymentPayload.CreatedAt = DateTime.UtcNow;
                paymentId = await _spaceService.CreatePaymentAsync(paymentPayload, callerSpaceId, role);
            }
            else
            {
                paymentId = existingPayment.PaymentId;
                await _spaceService.UpdatePaymentStatusAsync(spaceId, "Paid", paymentPayload.TransactionId, paymentPayload.PaymentMethod, callerSpaceId, role);
            }

            await _spaceService.GeneratePayslipsAsync(spaceId, paymentId, paymentPayload.Amount, callerSpaceId, role);
            return Ok(new { message = "Contract payment processed successfully and employee payslips generated.", paymentId });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to process contract payment.", details = ex.Message });
        }
    }

    [HttpGet("contract/{spaceId:int}/payslips")]
    public async Task<IActionResult> GetContractPayslips(int spaceId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var slips = await _spaceService.GetPayslipsBySpaceIdAsync(spaceId, callerSpaceId, role);
            return Ok(slips);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch contract payslips.", details = ex.Message });
        }
    }

    // --- PAYROLL ENDPOINTS ---

    [HttpGet("{spaceId:int}/payroll")]
    public async Task<IActionResult> GetSpacePayroll(int spaceId, [FromQuery] bool applyPenalties = true, [FromQuery] int? month = null, [FromQuery] int? year = null)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var summary = await _spaceService.GetSpacePayrollSummaryAsync(spaceId, callerSpaceId, role);
            var evaluations = await _spaceService.GetSpaceEmployeePayrollEvaluationsAsync(spaceId, month, year, callerSpaceId, role);

            var evalList = (evaluations as IEnumerable<dynamic>)?.ToList() ?? new List<dynamic>();
            var completeProfiles = evalList.Where(e => e.ProfileStatus == "Complete").ToList();
            var incompleteProfiles = evalList.Where(e => e.ProfileStatus != "Complete").ToList();
            decimal totalPayout = evalList.Sum(e => (decimal)e.FinalAmount);
            decimal totalDeductions = evalList.Sum(e => (decimal)e.TotalDeductions);

            return Ok(new {
                completeProfiles = completeProfiles,
                incompleteProfiles = incompleteProfiles,
                totalPayout = totalPayout,
                totalDeductions = totalDeductions,
                summary = summary,
                evaluations = evaluations
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SpaceController.GetSpacePayroll] Error: {ex.Message}");
            return StatusCode(500, new { error = "Payroll failed", message = ex.Message });
        }
    }

    [HttpPost("{spaceId:int}/payroll/pay")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PaySpacePayroll(int spaceId, [FromBody] PayrollPayoutRequest request)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var (successCount, groupId) = await _salaryService.PaySpacePayrollAsync(spaceId, request, callerSpaceId, role);
            return Ok(new { message = $"Successfully processed payroll for {successCount} employee(s).", groupId });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{spaceId:int}/payroll/confirm-payment")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ConfirmPayrollPayment(int spaceId, [FromBody] ConfirmPaymentRequest request)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            if (request == null || request.Employees == null || request.Employees.Count == 0)
            {
                return BadRequest("No employees provided.");
            }

            if (string.IsNullOrEmpty(request.OrderId) || string.IsNullOrEmpty(request.PaymentId))
            {
                return BadRequest(new { message = "Razorpay orderId and paymentId are required." });
            }

            var keySecret = _configuration["Razorpay:KeySecret"];
            bool isMock = string.IsNullOrEmpty(keySecret) 
                || keySecret == "YOUR_RAZORPAY_KEY_SECRET" 
                || keySecret == "YOUR_RAZORPAY_SECRET"
                || request.OrderId.StartsWith("order_mock_");
            
            if (!isMock)
            {
                try
                {
                    var payload = request.OrderId + "|" + request.PaymentId;
                    var secretBytes = System.Text.Encoding.UTF8.GetBytes(keySecret!);
                    using (var hmac = new System.Security.Cryptography.HMACSHA256(secretBytes))
                    {
                        var hashBytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(payload));
                        var computedSignature = Convert.ToHexString(hashBytes).ToLower();
                        if (computedSignature != request.Signature.ToLower())
                        {
                            return BadRequest(new { message = "Invalid Razorpay payment signature." });
                        }
                    }
                }
                catch (Exception ex)
                {
                    return BadRequest(new { message = "Razorpay payment signature verification failed.", details = ex.Message });
                }
            }

            var (successCount, groupId) = await _salaryService.ConfirmPayrollPaymentAsync(spaceId, request, callerSpaceId, role);
            return Ok(new { message = $"Successfully confirmed and processed Razorpay payroll for {successCount} employee(s).", groupId });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{spaceId:int}/payroll/reset")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetSpacePayroll(int spaceId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            await _salaryService.ResetSpacePayrollAsync(spaceId, callerSpaceId, role);
            return Ok(new { message = "Successfully reset all payroll payments and generated payslips for this space." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{spaceId:int}/payroll/razorpay/order")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateRazorpayOrder(int spaceId, [FromBody] RazorpayOrderRequest request)
    {
        try
        {
            var adminEmpId = GetEmpId();
            if (adminEmpId == 0) return Unauthorized();

            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            if (role != "Admin" && role != "SuperAdmin") return StatusCode(403, new { message = "Access denied." });
            if (role != "SuperAdmin" && spaceId != callerSpaceId) return StatusCode(403, new { message = "Access denied." });

            if (request == null || request.Amount <= 0)
            {
                return BadRequest(new { message = "Invalid payment amount." });
            }

            var keyId = _configuration["Razorpay:KeyId"];
            var keySecret = _configuration["Razorpay:KeySecret"];

            if (string.IsNullOrEmpty(keyId) || string.IsNullOrEmpty(keySecret) 
                || keyId == "YOUR_RAZORPAY_KEY_ID" || keyId == "YOUR_RAZORPAY_KEY"
                || keySecret == "YOUR_RAZORPAY_KEY_SECRET" || keySecret == "YOUR_RAZORPAY_SECRET")
            {
                var mockOrderId = "order_mock_" + Guid.NewGuid().ToString("N").Substring(0, 12);
                return Ok(new {
                    orderId = mockOrderId,
                    amount = request.Amount * 100,
                    currency = "INR",
                    key = "mock_key_id",
                    isMock = true
                });
            }

            using (var client = new System.Net.Http.HttpClient())
            {
                var authHeader = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{keyId}:{keySecret}"));
                client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", authHeader);

                var payload = new
                {
                    amount = (long)Math.Round(request.Amount * 100, 0),
                    currency = "INR",
                    receipt = $"payroll_{spaceId}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}"
                };

                var content = new System.Net.Http.StringContent(
                    System.Text.Json.JsonSerializer.Serialize(payload),
                    System.Text.Encoding.UTF8,
                    "application/json"
                );

                var response = await client.PostAsync("https://api.razorpay.com/v1/orders", content);
                var responseString = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return BadRequest(new { message = "Failed to create Razorpay order.", details = responseString });
                }

                using (var doc = System.Text.Json.JsonDocument.Parse(responseString))
                {
                    var orderId = doc.RootElement.GetProperty("id").GetString();
                    return Ok(new {
                        orderId = orderId,
                        amount = request.Amount * 100,
                        currency = "INR",
                        key = keyId,
                        isMock = false
                    });
                }
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Razorpay order creation threw an error.", details = ex.Message });
        }
    }

    public class RazorpayOrderRequest
    {
        public decimal Amount { get; set; }
    }

    [HttpPost("salary")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetEmployeeSalary([FromBody] EmployeeSalaryRequest request)
    {
        try
        {
            var adminEmpId = GetEmpId();
            if (adminEmpId == 0) return Unauthorized();

            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            if (request == null || request.EmpId <= 0 || request.Basic < 0)
                return BadRequest(new { message = "Invalid salary data." });

            var success = await _spaceService.UpdateEmployeeBasicSalaryAsync(request.EmpId, request.SpaceId, request.Basic, callerSpaceId, role);
            if (!success) return BadRequest(new { message = "Failed to update employee salary." });

            return Ok(new { message = "Employee salary updated successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error updating salary.", details = ex.Message });
        }
    }

    public class EmployeeSalaryRequest
    {
        public int EmpId { get; set; }
        public int SpaceId { get; set; }
        public decimal Basic { get; set; }
    }

    [HttpGet("{spaceId:int}/allowances")]
    public async Task<IActionResult> GetAllowances(int spaceId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var list = await _spaceService.GetAllowancesBySpaceIdAsync(spaceId, callerSpaceId, role);
            return Ok(list);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch allowances.", details = ex.Message });
        }
    }

    [HttpPost("{spaceId:int}/allowances")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateAllowance(int spaceId, [FromBody] Allowance allowance)
    {
        try
        {
            var adminEmpId = GetEmpId();
            if (adminEmpId == 0) return Unauthorized();

            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            allowance.SpaceId = spaceId;
            allowance.AdminId = adminEmpId;
            allowance.CreatedAt = DateTime.UtcNow;

            var allowanceId = await _spaceService.CreateAllowanceAsync(allowance, callerSpaceId, role);
            allowance.AllowanceId = allowanceId;
            return Ok(allowance);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create allowance.", details = ex.Message });
        }
    }

    [HttpDelete("allowances/{allowanceId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteAllowance(int allowanceId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var success = await _spaceService.DeleteAllowanceAsync(allowanceId, callerSpaceId, role);
            if (!success) return NotFound(new { message = "Allowance not found." });
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to delete allowance.", details = ex.Message });
        }
    }

    [HttpGet("{spaceId:int}/deductions")]
    public async Task<IActionResult> GetDeductions(int spaceId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var list = await _spaceService.GetDeductionsBySpaceIdAsync(spaceId, callerSpaceId, role);
            return Ok(list);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch deductions.", details = ex.Message });
        }
    }

    [HttpPost("{spaceId:int}/deductions")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateDeduction(int spaceId, [FromBody] Deduction deduction)
    {
        try
        {
            var adminEmpId = GetEmpId();
            if (adminEmpId == 0) return Unauthorized();

            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            deduction.SpaceId = spaceId;
            deduction.AdminId = adminEmpId;
            deduction.CreatedAt = DateTime.UtcNow;

            var deductionId = await _spaceService.CreateDeductionAsync(deduction, callerSpaceId, role);
            deduction.DeductionId = deductionId;
            return Ok(deduction);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to create deduction.", details = ex.Message });
        }
    }

    [HttpDelete("deductions/{deductionId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteDeduction(int deductionId)
    {
        try
        {
            var callerSpaceId = GetSpaceId();
            var role = GetRole();

            var success = await _spaceService.DeleteDeductionAsync(deductionId, callerSpaceId, role);
            if (!success) return NotFound(new { message = "Deduction not found." });
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to delete deduction.", details = ex.Message });
        }
    }
}
