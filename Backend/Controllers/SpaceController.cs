namespace Backend.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using Dapper;
using Microsoft.Extensions.DependencyInjection;
using Backend.Models;
using Backend.Repositories;

[ApiController]
[Route("api/spaces")]
public class SpaceController : ControllerBase
{
    private readonly ISpaceRepository _spaceRepository;
    private readonly IUserRepository _userRepository;
    private readonly IConfiguration _configuration;
    private readonly ISalaryRepository _salaryRepository;

    public SpaceController(ISpaceRepository spaceRepository, IUserRepository userRepository, IConfiguration configuration, ISalaryRepository salaryRepository)
    {
        _spaceRepository = spaceRepository;
        _userRepository = userRepository;
        _configuration = configuration;
        _salaryRepository = salaryRepository;
    }

    /// <summary>
    /// Resolves the logged-in employee ID from JWT claims.
    /// </summary>
    private async Task<int?> ResolveEmpIdAsync()
    {
        var empIdClaim = User.FindFirst("EmpId")?.Value 
                         ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                         ?? User.FindFirst("nameid")?.Value;

        if (string.IsNullOrEmpty(empIdClaim))
            return null;

        if (int.TryParse(empIdClaim, out int empId))
            return empId;

        var userByEmail = await _userRepository.GetUserByEmailAsync(empIdClaim);
        return userByEmail?.EmpId;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllSpaces()
    {
        var spaces = await _spaceRepository.GetAllSpacesAsync();
        return Ok(spaces);
    }

    [HttpGet("my")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetMySpaces()
    {
        var adminId = await ResolveEmpIdAsync();
        if (!adminId.HasValue)
            return Unauthorized(new { message = "Invalid admin session." });

        // Retrieve admin user details to check legacy space mapping
        var adminUser = await _userRepository.GetUserByIdAsync(adminId.Value);
        if (adminUser != null)
        {
            int? adminSpaceId = adminUser.SpaceId;
            if (adminSpaceId.HasValue && adminSpaceId.Value > 0)
            {
                // Verify if this space exists in t_spaces
                var spaceExists = await _spaceRepository.GetSpaceByIdAsync(adminSpaceId.Value);
                if (spaceExists == null)
                {
                    // Create the space in t_spaces with the exact legacy spaceid
                    try
                    {
                        var dbConnection = HttpContext.RequestServices.GetRequiredService<System.Data.IDbConnection>();
                        var insertQuery = @"
                            INSERT INTO t_spaces (spaceid, spacename, adminid, numberofemployees, createdat, isactive, type, workingdays) 
                            VALUES (@SpaceId, @SpaceName, @AdminId, 100, CURRENT_TIMESTAMP, TRUE, 'Department', '[""Mon"",""Tue"",""Wed"",""Thu"",""Fri""]')
                            ON CONFLICT (spaceid) DO NOTHING;";
                        await dbConnection.ExecuteAsync(insertQuery, new {
                            SpaceId = adminSpaceId.Value,
                            SpaceName = $"Workspace {adminSpaceId.Value}",
                            AdminId = adminId.Value
                        });

                        // Adjust sequence value to prevent auto-increment collisions
                        await dbConnection.ExecuteAsync("SELECT setval(pg_get_serial_sequence('t_spaces', 'spaceid'), COALESCE(MAX(spaceid), 1)) FROM t_spaces;");
                        System.Console.WriteLine($"[Resiliency Fix] Created missing space for legacy admin {adminUser.Email} with SpaceId {adminSpaceId.Value}");
                    }
                    catch (Exception ex)
                    {
                        System.Console.WriteLine($"[Resiliency Fix Error] Failed to auto-create space: {ex.Message}");
                    }
                }
                else if (spaceExists.AdminId != adminId.Value)
                {
                    // If the space exists but has no admin or a different admin, claim ownership
                    try
                    {
                        var dbConnection = HttpContext.RequestServices.GetRequiredService<System.Data.IDbConnection>();
                        await dbConnection.ExecuteAsync("UPDATE t_spaces SET adminid = @AdminId WHERE spaceid = @SpaceId;", new {
                            AdminId = adminId.Value,
                            SpaceId = adminSpaceId.Value
                        });
                        System.Console.WriteLine($"[Resiliency Fix] Aligned space ownership for SpaceId {adminSpaceId.Value} to Admin ID {adminId.Value}");
                    }
                    catch (Exception ex)
                    {
                        System.Console.WriteLine($"[Resiliency Fix Error] Failed to update space owner: {ex.Message}");
                    }
                }
            }
            else
            {
                // Admin has no SpaceId assigned. Let's see if they have spaces in t_spaces
                var adminSpaces = await _spaceRepository.GetSpacesByAdminIdAsync(adminId.Value);
                if (!adminSpaces.Any())
                {
                    // Create a brand new space for this admin
                    try
                    {
                        var newSpaceName = adminUser.Email.Split('@')[0] + "'s Space";
                        var space = new Space
                        {
                            SpaceName = newSpaceName,
                            AdminId = adminId.Value,
                            NumberOfEmployees = 100,
                            CreatedAt = DateTime.UtcNow,
                            IsActive = true,
                            Type = "Department",
                            WorkingDays = "[\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\"]"
                        };
                        int newSpaceId = await _spaceRepository.CreateSpaceAsync(space);
                        await _userRepository.UpdateUserSpaceIdAsync(adminId.Value, newSpaceId);
                        System.Console.WriteLine($"[Resiliency Fix] Created default new space {newSpaceName} (ID: {newSpaceId}) for admin {adminUser.Email}");
                    }
                    catch (Exception ex)
                    {
                        System.Console.WriteLine($"[Resiliency Fix Error] Failed to create new default space: {ex.Message}");
                    }
                }
            }
        }

        var spaces = await _spaceRepository.GetSpacesByAdminIdAsync(adminId.Value);
        var result = spaces.Select(s => new {
            spaceid = s.SpaceId,
            spacename = s.SpaceName
        });
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSpaceById(int id)
    {
        var space = await _spaceRepository.GetSpaceByIdAsync(id);
        if (space == null) return NotFound();
        return Ok(space);
    }

    // GET /api/spaces/admin/{adminId} -> returns all spaces of admin
    [HttpGet("admin/{adminId}")]
    public async Task<IActionResult> GetSpacesByAdmin(int adminId)
    {
        var spaces = await _spaceRepository.GetSpacesByAdminIdAsync(adminId);
        return Ok(spaces);
    }

    // GET /api/spaces/{spaceId}/employees -> employees of one space
    [HttpGet("{spaceId}/employees")]
    public async Task<IActionResult> GetEmployeesBySpace(int spaceId)
    {
        var employees = await _userRepository.GetUsersBySpaceIdAsync(spaceId);
        return Ok(employees);
    }

    // GET /api/spaces/admin/{adminId}/employees -> ALL employees under admin
    [HttpGet("admin/{adminId}/employees")]
    public async Task<IActionResult> GetAllEmployeesByAdmin(int adminId)
    {
        var employees = await _userRepository.GetUsersByAdminSpacesAsync(adminId);
        return Ok(employees);
    }

    // POST /api/spaces/create
    [HttpPost("create")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSpace([FromBody] Space space)
    {
        var empId = await ResolveEmpIdAsync();
        if (!empId.HasValue)
            return Unauthorized(new { message = "Invalid admin session." });

        space.AdminId = empId.Value; // adminid must always be empid
        space.CreatedAt = DateTime.UtcNow;
        space.IsActive = true;

        if (string.IsNullOrEmpty(space.Type)) space.Type = "Department";
        if (!space.NumberOfEmployees.HasValue) space.NumberOfEmployees = 100;
        if (!space.NumberOfBreaks.HasValue) space.NumberOfBreaks = 2;
        if (!space.BreakTime.HasValue) space.BreakTime = 60;
        if (!space.WorkStartTime.HasValue) space.WorkStartTime = TimeOnly.Parse("09:00:00");
        if (!space.WorkEndTime.HasValue) space.WorkEndTime = TimeOnly.Parse("18:00:00");
        if (!space.WorkingHours.HasValue) space.WorkingHours = 8;

        // Validate working days are not empty
        var validDays = new HashSet<string> { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
        var wdList = space.WorkingDaysList;
        if (wdList == null || wdList.Count == 0)
        {
            return BadRequest(new { message = "Working days list cannot be empty." });
        }
        
        if (wdList.Count > 7)
            return BadRequest(new { message = "Working days cannot exceed 7." });
        foreach (var d in wdList)
        {
            if (!validDays.Contains(d))
                return BadRequest(new { message = $"Invalid working day: '{d}'. Valid values: Sun, Mon, Tue, Wed, Thu, Fri, Sat." });
        }

        var spaceId = await _spaceRepository.CreateSpaceAsync(space);
        space.SpaceId = spaceId;
        return CreatedAtAction(nameof(GetSpaceById), new { id = spaceId }, space);
    }

    // Keep compatibility for POST /api/spaces or legacy root
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSpaceLegacy([FromBody] Space space)
    {
        return await CreateSpace(space);
    }

    // PUT /api/spaces/update/{spaceId}
    [HttpPut("update/{spaceId}")]
    [Authorize]
    public async Task<IActionResult> UpdateSpace(int spaceId, [FromBody] Space spacePayload)
    {
        var empId = await ResolveEmpIdAsync();
        if (!empId.HasValue)
            return Unauthorized(new { message = "Invalid employee session." });

        var user = await _userRepository.GetUserByIdAsync(empId.Value);
        if (user == null)
            return Unauthorized(new { message = "User not found." });

        var existingSpace = await _spaceRepository.GetSpaceByIdAsync(spaceId);
        if (existingSpace == null)
            return NotFound(new { message = "Space not found or has been deactivated." });

        // Security Check
        if (user.Role == "Admin")
        {
            if (existingSpace.AdminId != empId.Value)
            {
                return Forbid();
            }
        }
        else if (user.Role == "Manager" || user.Role == "AssistantManager")
        {
            if (user.SpaceId != spaceId)
            {
                return Forbid();
            }
        }
        else
        {
            return Forbid();
        }

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

        // Handle working days update
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

        var result = await _spaceRepository.UpdateSpaceAsync(existingSpace);
        if (!result)
            return BadRequest(new { message = "Failed to update space." });

        return NoContent();
    }

    // Keep compatibility for PUT /api/spaces/{id}
    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateSpaceLegacy(int id, [FromBody] Space spacePayload)
    {
        return await UpdateSpace(id, spacePayload);
    }

    // DELETE /api/spaces/delete/{id}
    [HttpDelete("delete/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSpace(int id)
    {
        var empId = await ResolveEmpIdAsync();
        if (!empId.HasValue)
            return Unauthorized(new { message = "Invalid admin session." });

        var existingSpace = await _spaceRepository.GetSpaceByIdAsync(id);
        if (existingSpace == null)
            return NotFound(new { message = "Space not found or has been deactivated." });

        if (existingSpace.AdminId != empId.Value)
            return Forbid();

        var result = await _spaceRepository.SoftDeleteSpaceAsync(id);
        if (!result) return NotFound();
        return NoContent();
    }

    // Keep compatibility for DELETE /api/spaces/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSpaceLegacy(int id)
    {
        return await DeleteSpace(id);
    }

    // --- CONTRACT ENDPOINTS ---

    [HttpGet("admin/{adminId}/contracts")]
    public async Task<IActionResult> GetContractsByAdmin(int adminId)
    {
        var activeSpaces = await _spaceRepository.GetSpacesByAdminIdAsync(adminId);
        foreach (var space in activeSpaces)
        {
            if (space.Type == "Contract")
            {
                await _spaceRepository.CheckAndUpdateContractExpiryAsync(space.SpaceId);
            }
        }

        var contracts = await _spaceRepository.GetContractsByAdminIdAsync(adminId);
        return Ok(contracts);
    }

    [HttpGet("admin/{adminId}/departments")]
    public async Task<IActionResult> GetDepartmentsByAdmin(int adminId)
    {
        var departments = await _spaceRepository.GetDepartmentsByAdminIdAsync(adminId);
        return Ok(departments);
    }

    [HttpGet("contract/{spaceId}/payment")]
    public async Task<IActionResult> GetContractPayment(int spaceId)
    {
        var payment = await _spaceRepository.GetPaymentBySpaceIdAsync(spaceId);
        if (payment == null)
        {
            var space = await _spaceRepository.GetSpaceByIdAsync(spaceId);
            if (space == null) return NotFound(new { message = "Space not found." });

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

    [HttpPost("contract/{spaceId}/pay")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PayContract(int spaceId, [FromBody] ContractPayment paymentPayload)
    {
        var empId = await ResolveEmpIdAsync();
        if (!empId.HasValue) return Unauthorized();

        var space = await _spaceRepository.GetSpaceByIdAsync(spaceId);
        if (space == null) return NotFound(new { message = "Contract space not found." });

        if (space.AdminId != empId.Value) return Forbid();

        var existingPayment = await _spaceRepository.GetPaymentBySpaceIdAsync(spaceId);
        int paymentId = 0;
        
        if (existingPayment == null)
        {
            paymentPayload.SpaceId = spaceId;
            paymentPayload.Status = "Paid";
            paymentPayload.PaidAt = DateTime.UtcNow;
            paymentPayload.CreatedAt = DateTime.UtcNow;
            paymentId = await _spaceRepository.CreatePaymentAsync(paymentPayload);
        }
        else
        {
            paymentId = existingPayment.PaymentId;
            await _spaceRepository.UpdatePaymentStatusAsync(spaceId, "Paid", paymentPayload.TransactionId, paymentPayload.PaymentMethod);
        }

        await _spaceRepository.GeneratePayslipsAsync(spaceId, paymentId, paymentPayload.Amount);

        return Ok(new { message = "Contract payment processed successfully and employee payslips generated.", paymentId });
    }

    [HttpGet("contract/{spaceId}/payslips")]
    public async Task<IActionResult> GetContractPayslips(int spaceId)
    {
        var slips = await _spaceRepository.GetPayslipsBySpaceIdAsync(spaceId);
        return Ok(slips);
    }

    // --- PAYROLL ENDPOINTS ---

    [HttpGet("{spaceId}/payroll")]
    public async Task<IActionResult> GetSpacePayroll(int spaceId, [FromQuery] bool applyPenalties = true, [FromQuery] int? month = null, [FromQuery] int? year = null)
    {
        try
        {
            var summary = await _spaceRepository.GetSpacePayrollSummaryAsync(spaceId);
            var evaluations = await _spaceRepository.GetSpaceEmployeePayrollEvaluationsAsync(spaceId, applyPenalties, month, year);

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
        catch (Exception ex)
        {
            Console.WriteLine("PAYROLL CONTROLLER ERROR:");
            Console.WriteLine(ex.ToString());

            return StatusCode(500, new {
                error = "Payroll failed",
                message = ex.Message
            });
        }
    }

    public class PayrollPayoutRequest
    {
        public List<EmployeePayoutItem> Employees { get; set; } = new();
        public string PaymentMethod { get; set; } = "Cash"; // Cash / UPI / Razorpay
        public string? TransactionId { get; set; }
    }

    public class ConfirmPaymentRequest
    {
        public string OrderId { get; set; } = string.Empty;
        public string PaymentId { get; set; } = string.Empty;
        public string Signature { get; set; } = string.Empty;
        public List<EmployeePayoutItem> Employees { get; set; } = new();
    }

    public class EmployeePayoutItem
    {
        public int EmpId { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal Deduction { get; set; }
        public decimal FinalAmount { get; set; }
        public bool IsManual { get; set; }
        public decimal AllowanceAmount { get; set; }
        public decimal DeductionAmount { get; set; }
        public decimal Basic { get; set; }
        public decimal TotalAllowance { get; set; }
        public decimal TotalDeduction { get; set; }
        public string? Breakdown { get; set; }
    }

    private string? ValidatePayoutProfile(string paymentMethod, dynamic eval)
    {
        var name = eval.Name?.ToString() ?? "Employee";
        if (paymentMethod == "UPI")
        {
            var upiid = eval.UpiId?.ToString();
            if (string.IsNullOrWhiteSpace(upiid))
            {
                return $"Employee '{name}' does not have a UPI ID configured. UPI ID is required for UPI payments.";
            }
        }
        else if (paymentMethod == "Razorpay" || paymentMethod == "Bank Transfer")
        {
            var accNum = eval.AccountNumber?.ToString();
            var bankName = eval.BankName?.ToString();
            var accHolder = eval.AccountHolderName?.ToString();
            var ifsc = eval.IfscCode?.ToString();

            if (string.IsNullOrWhiteSpace(accNum) || string.IsNullOrWhiteSpace(bankName) || string.IsNullOrWhiteSpace(accHolder) || string.IsNullOrWhiteSpace(ifsc))
            {
                return $"Employee '{name}' is missing bank configuration details. Bank details (Account Number, Bank Name, Account Holder, and IFSC) are required for {paymentMethod} payments.";
            }
        }
        return null;
    }

    private async Task<(int successCount, Guid groupId)> ProcessPayoutBatchAsync(
        int spaceId, 
        List<EmployeePayoutItem> employees, 
        string paymentMethod, 
        string? transactionId, 
        Guid? groupIdVal)
    {
        var evaluations = await _spaceRepository.GetSpaceEmployeePayrollEvaluationsAsync(spaceId);
        var evalDict = new Dictionary<int, dynamic>();
        foreach (var ev in evaluations)
        {
            evalDict[Convert.ToInt32(ev.EmpId)] = ev;
        }

        Guid groupId = groupIdVal ?? (employees.Count > 1 ? Guid.NewGuid() : Guid.Empty);
        int successCount = 0;

        foreach (var item in employees)
        {
            if (!evalDict.TryGetValue(item.EmpId, out var eval))
            {
                throw new Exception($"Employee with ID {item.EmpId} does not belong to this Space.");
            }

            var validationError = ValidatePayoutProfile(paymentMethod, eval);
            if (validationError != null)
            {
                throw new Exception(validationError);
            }

            // Retrieve live salary evaluations directly from backend as source of truth
            var salaryResponse = await _salaryRepository.GetSalaryAsync(item.EmpId, DateTime.UtcNow.Month, DateTime.UtcNow.Year);
            if (salaryResponse == null)
            {
                throw new Exception($"Failed to evaluate salary structure for employee #{item.EmpId}.");
            }

            var basicVal = salaryResponse.Basic;
            var hraVal = salaryResponse.Hra;
            var daVal = salaryResponse.Da;
            
            var allowancesList = salaryResponse.Allowances.Select(a => new { name = a.Name, type = a.Type, value = a.Value, amount = a.Amount }).ToList();
            var deductionsList = salaryResponse.Deductions.Where(d => d.DeductionType == "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount }).ToList();
            var penaltiesList = salaryResponse.Deductions.Where(d => d.DeductionType != "Standard").Select(d => new { name = d.Name, type = d.Type, value = d.Value, amount = d.Amount, deductionType = d.DeductionType }).ToList();

            var finalAmountToPay = item.IsManual ? item.FinalAmount : salaryResponse.Net;

            var breakdownObj = new
            {
                basic = basicVal,
                hra = hraVal,
                da = daVal,
                allowances = allowancesList,
                deductions = deductionsList,
                penalties = penaltiesList,
                finalAmount = finalAmountToPay
            };

            string breakdownJson = System.Text.Json.JsonSerializer.Serialize(breakdownObj);

            var payrollPayment = new PayrollPayment
            {
                EmpId = item.EmpId,
                SpaceId = spaceId,
                TotalAmount = basicVal + salaryResponse.Hra + salaryResponse.Da,
                Deduction = salaryResponse.Deductions.Sum(d => d.Amount),
                FinalAmount = finalAmountToPay,
                Status = "Paid",
                PaidAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                IsManual = item.IsManual,
                AllowanceAmount = salaryResponse.Allowances.Sum(a => a.Amount),
                DeductionAmount = salaryResponse.Deductions.Sum(d => d.Amount),
                PaymentMethod = paymentMethod,
                TransactionId = transactionId,
                GroupId = groupId == Guid.Empty ? null : groupId
            };

            int paymentId = await _spaceRepository.CreatePayrollPaymentAsync(payrollPayment);

            if (paymentId > 0)
            {
                try
                {
                    var slip = new Payslip
                    {
                        EmpId = item.EmpId,
                        SpaceId = spaceId,
                        BaseAmount = payrollPayment.TotalAmount,
                        Deduction = payrollPayment.Deduction,
                        FinalAmount = finalAmountToPay,
                        Type = "Payroll",
                        PaymentId = paymentId,
                        GeneratedAt = DateTime.UtcNow,
                        Basic = basicVal,
                        TotalAllowance = payrollPayment.AllowanceAmount,
                        TotalDeduction = payrollPayment.Deduction,
                        Breakdown = breakdownJson,
                        PaymentMethod = paymentMethod,
                        TransactionId = transactionId,
                        AccountNumber = eval.AccountNumber?.ToString(),
                        BankName = eval.BankName?.ToString(),
                        AccountHolderName = eval.AccountHolderName?.ToString(),
                        IfscCode = eval.IfscCode?.ToString(),
                        UpiId = eval.UpiId?.ToString()
                    };

                    await _spaceRepository.GeneratePayrollPayslipAsync(slip);
                }
                catch (Exception slipEx)
                {
                    System.Console.WriteLine($"[Payslip Generation Warning] Payment #{paymentId} for EmpId {item.EmpId} was saved, but payslip generation failed: {slipEx.Message}");
                }
                successCount++;
            }
        }

        return (successCount, groupId);
    }

    [HttpPost("{spaceId}/payroll/pay")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PaySpacePayroll(int spaceId, [FromBody] PayrollPayoutRequest request)
    {
        try
        {
            var adminEmpId = await ResolveEmpIdAsync();
            if (!adminEmpId.HasValue) return Unauthorized();

            var space = await _spaceRepository.GetSpaceByIdAsync(spaceId);
            if (space == null) return NotFound(new { message = "Space not found." });

            if (space.AdminId != adminEmpId.Value) return Forbid();

            if (request == null || request.Employees == null || request.Employees.Count == 0)
            {
                return BadRequest("No employees");
            }

            var paymentMethod = request.PaymentMethod?.Trim();
            if (paymentMethod != "Cash" && paymentMethod != "UPI" && paymentMethod != "Bank Transfer")
            {
                return BadRequest(new { message = "Invalid payment method for this endpoint. Please use Cash, UPI, or Bank Transfer." });
            }

            if (request.Employees.Count > 1 && paymentMethod == "UPI")
            {
                return BadRequest(new { message = "Direct UPI payment is NOT allowed for multiple employees (bulk payout)." });
            }

            var (successCount, groupId) = await ProcessPayoutBatchAsync(spaceId, request.Employees, paymentMethod, request.TransactionId, null);
            return Ok(new { message = $"Successfully processed payroll for {successCount} employee(s).", groupId });
        }
        catch (Exception ex)
        {
            System.Console.WriteLine($"[PaySpacePayroll Error] {ex.Message} \n {ex.StackTrace}");
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{spaceId}/payroll/confirm-payment")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ConfirmPayrollPayment(int spaceId, [FromBody] ConfirmPaymentRequest request)
    {
        try
        {
            var adminEmpId = await ResolveEmpIdAsync();
            if (!adminEmpId.HasValue) return Unauthorized();

            var space = await _spaceRepository.GetSpaceByIdAsync(spaceId);
            if (space == null) return NotFound(new { message = "Space not found." });

            if (space.AdminId != adminEmpId.Value) return Forbid();

            if (request == null || request.Employees == null || request.Employees.Count == 0)
            {
                return BadRequest("No employees");
            }

            if (string.IsNullOrEmpty(request.OrderId) || string.IsNullOrEmpty(request.PaymentId))
            {
                return BadRequest(new { message = "Razorpay orderId and paymentId are required." });
            }

            // Verify Razorpay signature if secret exists and not mock
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
                    System.Console.WriteLine($"[Signature Verification Error] {ex.Message}");
                    return BadRequest(new { message = "Razorpay payment signature verification failed." });
                }
            }

            var (successCount, groupId) = await ProcessPayoutBatchAsync(spaceId, request.Employees, "Razorpay", request.PaymentId, null);
            return Ok(new { message = $"Successfully confirmed and processed Razorpay payroll for {successCount} employee(s).", groupId });
        }
        catch (Exception ex)
        {
            System.Console.WriteLine($"[ConfirmPayrollPayment Error] {ex.Message} \n {ex.StackTrace}");
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{spaceId}/payroll/reset")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetSpacePayroll(int spaceId)
    {
        var adminEmpId = await ResolveEmpIdAsync();
        if (!adminEmpId.HasValue) return Unauthorized();

        var space = await _spaceRepository.GetSpaceByIdAsync(spaceId);
        if (space == null) return NotFound(new { message = "Space not found." });

        if (space.AdminId != adminEmpId.Value) return Forbid();

        await _spaceRepository.ResetSpacePayrollPaymentsAsync(spaceId);
        return Ok(new { message = "Successfully reset all payroll payments and generated payslips for this space." });
    }

    [HttpPost("{spaceId}/payroll/razorpay/order")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateRazorpayOrder(int spaceId, [FromBody] RazorpayOrderRequest request)
    {
        var adminEmpId = await ResolveEmpIdAsync();
        if (!adminEmpId.HasValue) return Unauthorized();

        var space = await _spaceRepository.GetSpaceByIdAsync(spaceId);
        if (space == null) return NotFound(new { message = "Space not found." });
        if (space.AdminId != adminEmpId.Value) return Forbid();

        if (request == null || request.Amount <= 0)
        {
            return BadRequest(new { message = "Invalid payment amount." });
        }

        // Check appsettings config
        var keyId = _configuration["Razorpay:KeyId"];
        var keySecret = _configuration["Razorpay:KeySecret"];

        if (string.IsNullOrEmpty(keyId) || string.IsNullOrEmpty(keySecret) 
            || keyId == "YOUR_RAZORPAY_KEY_ID" || keyId == "YOUR_RAZORPAY_KEY"
            || keySecret == "YOUR_RAZORPAY_KEY_SECRET" || keySecret == "YOUR_RAZORPAY_SECRET")
        {
            // Fallback mock mode
            var mockOrderId = "order_mock_" + Guid.NewGuid().ToString("N").Substring(0, 12);
            System.Console.WriteLine($"[Razorpay Mock Mode] Generated mock order ID: {mockOrderId} for amount: {request.Amount}");
            return Ok(new {
                orderId = mockOrderId,
                amount = request.Amount * 100,
                currency = "INR",
                key = "mock_key_id",
                isMock = true
            });
        }

        try
        {
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
                    System.Console.WriteLine($"[Razorpay Order Error] {responseString}");
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
        var adminEmpId = await ResolveEmpIdAsync();
        if (!adminEmpId.HasValue) return Unauthorized();

        if (request == null || request.EmpId <= 0 || request.Basic < 0)
            return BadRequest(new { message = "Invalid salary data." });

        var success = await _spaceRepository.UpdateEmployeeBasicSalaryAsync(request.EmpId, request.SpaceId, request.Basic);
        if (!success) return BadRequest(new { message = "Failed to update employee salary." });

        return Ok(new { message = "Employee salary updated successfully." });
    }

    public class EmployeeSalaryRequest
    {
        public int EmpId { get; set; }
        public int SpaceId { get; set; }
        public decimal Basic { get; set; }
    }

    [HttpGet("{spaceId}/allowances")]
    public async Task<IActionResult> GetAllowances(int spaceId)
    {
        var list = await _spaceRepository.GetAllowancesBySpaceIdAsync(spaceId);
        return Ok(list);
    }

    [HttpPost("{spaceId}/allowances")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateAllowance(int spaceId, [FromBody] Allowance allowance)
    {
        var adminEmpId = await ResolveEmpIdAsync();
        if (!adminEmpId.HasValue) return Unauthorized();

        allowance.SpaceId = spaceId;
        allowance.AdminId = adminEmpId.Value;
        allowance.CreatedAt = DateTime.UtcNow;

        var allowanceId = await _spaceRepository.CreateAllowanceAsync(allowance);
        allowance.AllowanceId = allowanceId;
        return Ok(allowance);
    }

    [HttpDelete("allowances/{allowanceId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteAllowance(int allowanceId)
    {
        var success = await _spaceRepository.DeleteAllowanceAsync(allowanceId);
        if (!success) return NotFound(new { message = "Allowance not found." });
        return NoContent();
    }

    [HttpGet("{spaceId}/deductions")]
    public async Task<IActionResult> GetDeductions(int spaceId)
    {
        var list = await _spaceRepository.GetDeductionsBySpaceIdAsync(spaceId);
        return Ok(list);
    }

    [HttpPost("{spaceId}/deductions")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateDeduction(int spaceId, [FromBody] Deduction deduction)
    {
        var adminEmpId = await ResolveEmpIdAsync();
        if (!adminEmpId.HasValue) return Unauthorized();

        deduction.SpaceId = spaceId;
        deduction.AdminId = adminEmpId.Value;
        deduction.CreatedAt = DateTime.UtcNow;

        var deductionId = await _spaceRepository.CreateDeductionAsync(deduction);
        deduction.DeductionId = deductionId;
        return Ok(deduction);
    }

    [HttpDelete("deductions/{deductionId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteDeduction(int deductionId)
    {
        var success = await _spaceRepository.DeleteDeductionAsync(deductionId);
        if (!success) return NotFound(new { message = "Deduction not found." });
        return NoContent();
    }

    [HttpGet("diagnostics")]
    [AllowAnonymous]
    public async Task<IActionResult> RunDiagnostics()
    {
        var dbConn = HttpContext.RequestServices.GetService(typeof(System.Data.IDbConnection)) as System.Data.IDbConnection;
        if (dbConn == null)
            return StatusCode(500, "Could not resolve database connection.");

        var admins = await Dapper.SqlMapper.QueryAsync(dbConn, "SELECT empid, email, passwordhash FROM t_users WHERE role = 'Admin';");
        var spaces = await Dapper.SqlMapper.QueryAsync(dbConn, "SELECT spaceid, spacename, adminid FROM t_spaces;");

        return Ok(new { admins, spaces });
    }

    [HttpGet("diagnostics-fix")]
    [AllowAnonymous]
    public async Task<IActionResult> RunDiagnosticsFix([FromQuery] int adminId, [FromQuery] int spaceId)
    {
        var dbConn = HttpContext.RequestServices.GetService(typeof(System.Data.IDbConnection)) as System.Data.IDbConnection;
        if (dbConn == null)
            return StatusCode(500, "Could not resolve database connection.");

        var query = "UPDATE t_spaces SET adminid = @AdminId WHERE spaceid = @SpaceId";
        var result = await Dapper.SqlMapper.ExecuteAsync(dbConn, query, new { AdminId = adminId, SpaceId = spaceId });

        return Ok(new { message = $"Successfully updated {result} row(s). spaceid = {spaceId} is now assigned to adminid = {adminId}." });
    }
}
