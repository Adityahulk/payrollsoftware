namespace Backend.Models
{
    using System;

    public class PayslipSetting
    {
        public int SettingId { get; set; }
        public int SpaceId { get; set; }
        public string CompanyName { get; set; }
        public string LogoUrl { get; set; }
        public string TemplateSelector { get; set; }
        public string TableType { get; set; }
        public bool ShowBaseSalary { get; set; }
        public bool ShowAllowances { get; set; }
        public bool ShowDeductions { get; set; }
        public bool ShowAttendance { get; set; }
        public bool ShowLeaveStats { get; set; }
        public bool ShowOvertime { get; set; }
        public bool ShowTaxDetails { get; set; }
        public bool ShowSignature { get; set; }
        public string SignatoryName { get; set; }
        public string FooterText { get; set; }
        public string ContactEmail { get; set; }
        public string ContactPhone { get; set; }
        public string CompanyAddress { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
