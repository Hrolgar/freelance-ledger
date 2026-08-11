using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace FreelanceLedger.Api.Models;

public class Milestone
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [JsonIgnore]
    [ValidateNever]
    public Project Project { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Amount { get; set; }
    public Currency Currency { get; set; }
    public MilestoneStatus Status { get; set; }
    public DateOnly? DateDue { get; set; }
    public DateOnly? DatePaid { get; set; }
    public int SortOrder { get; set; }

    // --- Hourly invoice fields. All null on ordinary fixed-price milestones. ---
    // When a milestone represents a generated invoice, these record how the Amount
    // was derived so the line reads "19.5h x USD 60.00" and stays reproducible.
    public decimal? Hours { get; set; }
    public decimal? RateApplied { get; set; }
    public DateOnly? PeriodStart { get; set; }
    public DateOnly? PeriodEnd { get; set; }
    public string? InvoiceNumber { get; set; }

    /// The date the invoice was issued, stamped once when it is raised. Without this the
    /// document would print whatever today happens to be, so re-downloading an invoice
    /// next month would silently change its date.
    public DateOnly? InvoiceDate { get; set; }

    [JsonIgnore]
    [ValidateNever]
    public ICollection<TimeEntry> TimeEntries { get; set; } = [];
}
