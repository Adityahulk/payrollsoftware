using System;

namespace Backend.Models
{
    public class ProjectFile
    {
        public int FileId { get; set; }
        public int ProjectId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
