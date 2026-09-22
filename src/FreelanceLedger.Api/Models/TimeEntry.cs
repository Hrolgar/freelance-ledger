using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace FreelanceLedger.Api.Models;

/// A billable period of hours on an hourly project.
///
/// The period is explicit rather than implied so weekly and monthly projects share one
/// table: a week runs Monday to Sunday, a month the 1st to the last, and an ad-hoc
/// block can be any span. Periods on a project must not overlap.
///
/// RateApplied and Currency are SNAPSHOTTED when the entry is created, from the rate
/// effective on PeriodStart. They are deliberately never recomputed: when the rate goes
/// from 60 to 80, periods already logged at 60 stay at 60 and issued invoices stay
/// reproducible.
public class TimeEntry
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [JsonIgnore]
    [ValidateNever]
    public Project Project { get; set; } = null!;

    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }

    public decimal Hours { get; set; }
    public string? Notes { get; set; }

    public decimal RateApplied { get; set; }
    public Currency Currency { get; set; }

    /// The rate category this period was logged under (see ProjectRate.Category), which
    /// is what picked RateApplied. Null on a project with a single rate. Periods in
    /// different categories may share a day: the overlap rule is per category, because
    /// an hour of in-house work and an hour of customer work on the same date are two
    /// different things billed at two different prices.
    public string? Category { get; set; }

    /// Null until the period is swept into an invoice. Once set, the period is billed
    /// and a later invoice run will not pick it up again.
    public int? InvoiceMilestoneId { get; set; }
    [JsonIgnore]
    [ValidateNever]
    public Milestone? InvoiceMilestone { get; set; }

    /// Convenience for the UI so it does not have to re-derive the shape of a period.
    [NotMapped]
    public decimal Amount => Hours * RateApplied;
}
