namespace Backend.Controllers
{
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Http;
    using System;
    using System.IO;
    using System.Data;
    using System.Threading.Tasks;
    using Dapper;
    using Backend.Models;

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SettingsController : ControllerBase
    {
        private readonly IDbConnection _db;

        public SettingsController(IDbConnection db)
        {
            _db = db;
        }

        // GET /api/settings/payslip
        [HttpGet("payslip")]
        public async Task<IActionResult> GetPayslipSettings()
        {
            try
            {
                var spaceIdClaim = User.FindFirst("SpaceId")?.Value;
                if (!int.TryParse(spaceIdClaim, out int spaceId) || spaceId <= 0)
                {
                    return BadRequest(new { message = "Invalid space context in token." });
                }

                var sql = "SELECT * FROM t_payslip_settings WHERE spaceid = @SpaceId;";
                var settings = await _db.QueryFirstOrDefaultAsync<PayslipSetting>(sql, new { SpaceId = spaceId });

                if (settings == null)
                {
                    // Fetch space name for default settings
                    var spaceName = await _db.ExecuteScalarAsync<string>("SELECT spacename FROM t_spaces WHERE spaceid = @SpaceId", new { SpaceId = spaceId }) ?? "My Company";
                    settings = new PayslipSetting
                    {
                        SpaceId = spaceId,
                        CompanyName = spaceName,
                        LogoUrl = "",
                        TemplateSelector = "Default",
                        TableType = "Standard",
                        ShowBaseSalary = true,
                        ShowAllowances = true,
                        ShowDeductions = true,
                        ShowAttendance = true,
                        ShowLeaveStats = true,
                        ShowOvertime = true,
                        ShowTaxDetails = true,
                        ShowSignature = true,
                        SignatoryName = "Authorized Signatory",
                        FooterText = "This is a computer-generated payslip and does not require a physical signature.",
                        ContactEmail = "",
                        ContactPhone = "",
                        CompanyAddress = ""
                    };
                }

                return Ok(settings);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SettingsController] Error in GetPayslipSettings: {ex.Message}");
                return StatusCode(500, new { message = "Failed to retrieve payslip settings.", error = ex.Message });
            }
        }

        // POST /api/settings/payslip
        [HttpPost("payslip")]
        public async Task<IActionResult> SavePayslipSettings([FromForm] PayslipSettingsForm form)
        {
            try
            {
                var spaceIdClaim = User.FindFirst("SpaceId")?.Value;
                if (!int.TryParse(spaceIdClaim, out int spaceId) || spaceId <= 0)
                {
                    return BadRequest(new { message = "Invalid space context in token." });
                }

                // Get existing logo URL if any
                var existingLogoUrl = await _db.ExecuteScalarAsync<string>("SELECT logourl FROM t_payslip_settings WHERE spaceid = @SpaceId", new { SpaceId = spaceId }) ?? "";

                string logoUrl = existingLogoUrl;
                if (form.LogoFile != null && form.LogoFile.Length > 0)
                {
                    var wwwroot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                    var folder = Path.Combine(wwwroot, "payslip-logo");
                    Directory.CreateDirectory(folder);

                    var ext = Path.GetExtension(form.LogoFile.FileName);
                    var fileName = $"logo_space_{spaceId}_{DateTime.UtcNow.Ticks}{ext}";
                    var filePath = Path.Combine(folder, fileName);

                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await form.LogoFile.CopyToAsync(stream);
                    }

                    logoUrl = $"/payslip-logo/{fileName}";
                }

                var sql = @"
                    INSERT INTO t_payslip_settings (
                        spaceid, companyname, logourl, templateselector, tabletype,
                        showbasesalary, showallowances, showdeductions, showattendance, showleavestats,
                        showovertime, showtaxdetails, showsignature, signatoryname, footertext,
                        contactemail, contactphone, companyaddress, createdat, updatedat
                    )
                    VALUES (
                        @SpaceId, @CompanyName, @LogoUrl, @TemplateSelector, @TableType,
                        @ShowBaseSalary, @ShowAllowances, @ShowDeductions, @ShowAttendance, @ShowLeaveStats,
                        @ShowOvertime, @ShowTaxDetails, @ShowSignature, @SignatoryName, @FooterText,
                        @ContactEmail, @ContactPhone, @CompanyAddress, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (spaceid)
                    DO UPDATE SET
                        companyname = EXCLUDED.companyname,
                        logourl = EXCLUDED.logourl,
                        templateselector = EXCLUDED.templateselector,
                        tabletype = EXCLUDED.tabletype,
                        showbasesalary = EXCLUDED.showbasesalary,
                        showallowances = EXCLUDED.showallowances,
                        showdeductions = EXCLUDED.showdeductions,
                        showattendance = EXCLUDED.showattendance,
                        showleavestats = EXCLUDED.showleavestats,
                        showovertime = EXCLUDED.showovertime,
                        showtaxdetails = EXCLUDED.showtaxdetails,
                        showsignature = EXCLUDED.showsignature,
                        signatoryname = EXCLUDED.signatoryname,
                        footertext = EXCLUDED.footertext,
                        contactemail = EXCLUDED.contactemail,
                        contactphone = EXCLUDED.contactphone,
                        companyaddress = EXCLUDED.companyaddress,
                        updatedat = CURRENT_TIMESTAMP
                    RETURNING *;";

                var updated = await _db.QueryFirstOrDefaultAsync<PayslipSetting>(sql, new
                {
                    SpaceId = spaceId,
                    CompanyName = form.CompanyName ?? "",
                    LogoUrl = logoUrl,
                    TemplateSelector = form.TemplateSelector ?? "Default",
                    TableType = form.TableType ?? "Standard",
                    ShowBaseSalary = form.ShowBaseSalary,
                    ShowAllowances = form.ShowAllowances,
                    ShowDeductions = form.ShowDeductions,
                    ShowAttendance = form.ShowAttendance,
                    ShowLeaveStats = form.ShowLeaveStats,
                    ShowOvertime = form.ShowOvertime,
                    ShowTaxDetails = form.ShowTaxDetails,
                    ShowSignature = form.ShowSignature,
                    SignatoryName = form.SignatoryName ?? "",
                    FooterText = form.FooterText ?? "",
                    ContactEmail = form.ContactEmail ?? "",
                    ContactPhone = form.ContactPhone ?? "",
                    CompanyAddress = form.CompanyAddress ?? ""
                });

                return Ok(updated);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SettingsController] Error in SavePayslipSettings: {ex.Message}");
                return StatusCode(500, new { message = "Failed to save payslip settings.", error = ex.Message });
            }
        }
    }

    public class PayslipSettingsForm
    {
        public string? CompanyName { get; set; }
        public string? TemplateSelector { get; set; }
        public string? TableType { get; set; }
        public bool ShowBaseSalary { get; set; }
        public bool ShowAllowances { get; set; }
        public bool ShowDeductions { get; set; }
        public bool ShowAttendance { get; set; }
        public bool ShowLeaveStats { get; set; }
        public bool ShowOvertime { get; set; }
        public bool ShowTaxDetails { get; set; }
        public bool ShowSignature { get; set; }
        public string? SignatoryName { get; set; }
        public string? FooterText { get; set; }
        public string? ContactEmail { get; set; }
        public string? ContactPhone { get; set; }
        public string? CompanyAddress { get; set; }
        public IFormFile? LogoFile { get; set; }
    }
}
