using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace FreelanceLedger.Api.Models;

/// One entry in a project's hourly rate history. The rate in force on a given date is
/// the row with the greatest EffectiveFrom that is on or before it, so raising the rate
/// is an INSERT with a future EffectiveFrom -- already-logged weeks are never rewritten.
public class ProjectRate
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [JsonIgnore]
    [ValidateNever]
    public Project Project { get; set; } = null!;

    public decimal Rate { get; set; }
    public Currency Currency { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public string? Notes { get; set; }

    /// Which kind of work this rate prices, when a project bills more than one kind at
    /// different rates -- OC pays one rate for in-house work and another for work that
    /// is charged on to their customer. Null is the project's single (or default) rate.
    /// Each category has its own history: raising the "Contracted out" rate inserts a
    /// row with that category and a later EffectiveFrom, and never touches the others.
    /// The name is printed on the invoice as the line description when an invoice
    /// mixes categories, so name it the way the client should read it.
    public string? Category { get; set; }
}
