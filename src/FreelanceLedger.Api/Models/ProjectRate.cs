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
}
