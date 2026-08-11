using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace FreelanceLedger.Api.Models;

public class ProjectFile
{
    public int Id { get; set; }
    public int ProjectId { get; set; }

    [JsonIgnore]
    [ValidateNever]
    public Project Project { get; set; } = null!;

    public string OriginalFilename { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }

    /// Set when this file was filed automatically by raising an invoice, rather than
    /// uploaded by hand. Lets the copy be replaced on re-issue and removed when the
    /// invoice is deleted, instead of leaving orphans behind in the Files list.
    public int? SourceInvoiceMilestoneId { get; set; }
}
