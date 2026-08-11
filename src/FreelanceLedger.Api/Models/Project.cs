namespace FreelanceLedger.Api.Models;

public class Project
{
    public int Id { get; set; }
    public int? ClientId { get; set; }
    public Client? Client { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public int? PlatformId { get; set; }
    public Platform? Platform { get; set; }
    public Currency Currency { get; set; }
    public decimal FeePercentage { get; set; }
    public decimal? InitialFullPrice { get; set; }
    public ProjectStatus Status { get; set; }
    public DateOnly? DateAwarded { get; set; }
    public DateOnly? DateCompleted { get; set; }
    public string? Notes { get; set; }

    // Fixed-price projects bill through milestones only. Hourly projects additionally
    // carry a rate history and weekly time entries, which roll up into invoices --
    // and an invoice is itself stored as a Milestone so all existing revenue,
    // monthly P&L, pipeline and fee maths keep working unchanged.
    public BillingType BillingType { get; set; } = BillingType.Fixed;

    /// Prefix for generated invoice numbers, e.g. "OC" yields OC-2026-001.
    public string? InvoicePrefix { get; set; }

    /// Who the invoice is addressed to, one line per line. This is often NOT the
    /// client's display name: an invoice usually has to name the legal entity rather
    /// than the person or the brand, or it stalls in their accounts payable. Falls
    /// back to the client name when blank.
    public string? BillTo { get; set; }

    /// How often committed hours recur on this project: weekly, monthly, or not at all.
    public HoursCadence Cadence { get; set; } = HoursCadence.None;

    /// The fixed block of hours billed each cadence period, e.g. 10 a week or 40 a
    /// month. A prefill, not a cap -- a generated period can still be edited before
    /// it is invoiced.
    public decimal? CommittedHours { get; set; }

    public ICollection<Milestone> Milestones { get; set; } = [];
    public ICollection<Tip> Tips { get; set; } = [];
    public ICollection<ProjectFile> Files { get; set; } = [];
    public ICollection<ProjectRate> Rates { get; set; } = [];
    public ICollection<TimeEntry> TimeEntries { get; set; } = [];
}
