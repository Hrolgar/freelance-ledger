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

    /// The paragraph printed under "Work performed", above the table. Describes what the
    /// hours were spent on and under which agreement. Prefills every new invoice on this
    /// project, and each invoice keeps its own copy so editing this never rewrites history.
    public string? InvoiceWorkDescription { get; set; }

    /// What the single table row is called, e.g. "Engineering services, hourly".
    public string? InvoiceLineLabel { get; set; }

    /// Day of the month this client pays, e.g. 20 for "on or about the 20th". Used to
    /// default the due date on a new invoice and to phrase the payment sentence.
    public int? PaymentDueDayOfMonth { get; set; }

    /// Payment terms for THIS client, overriding the one in the invoice profile.
    /// e.g. "Payment due on or about the 20th of the following month, per the SOW."
    public string? InvoiceTermsNote { get; set; }

    /// How often committed hours recur on this project: weekly, monthly, or not at all.
    public HoursCadence Cadence { get; set; } = HoursCadence.None;

    /// The fixed block of hours billed each cadence period, e.g. 10 a week or 40 a
    /// month. A prefill, not a cap -- a generated period can still be edited before
    /// it is invoiced.
    public decimal? CommittedHours { get; set; }

    /// VAT charged on this project's invoices, as a percentage (25 for Norwegian MVA).
    /// NULL means no VAT is charged and the profile's VatNote explains why; 0 means
    /// explicitly zero-rated. The distinction matters on the printed document.
    public decimal? VatRate { get; set; }

    /// Language the invoice document is rendered in. Null = automatic: Norwegian when
    /// the invoice's own (frozen) VatRate is set, English otherwise.
    public InvoiceLanguage? InvoiceLanguage { get; set; }

    /// When true, the background service raises last month's retainer invoice on its
    /// own. Retainer projects only.
    public bool AutoRaiseInvoice { get; set; }

    public ICollection<Milestone> Milestones { get; set; } = [];
    public ICollection<Tip> Tips { get; set; } = [];
    public ICollection<ProjectFile> Files { get; set; } = [];
    public ICollection<ProjectRate> Rates { get; set; } = [];
    public ICollection<TimeEntry> TimeEntries { get; set; } = [];
}
