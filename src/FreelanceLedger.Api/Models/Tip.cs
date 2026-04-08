using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace FreelanceLedger.Api.Models;

public class Tip
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [JsonIgnore]
    [ValidateNever]
    public Project Project { get; set; } = null!;

    public decimal Amount { get; set; }
    public Currency Currency { get; set; }
    public DateOnly Date { get; set; }
    public string? Notes { get; set; }
}
