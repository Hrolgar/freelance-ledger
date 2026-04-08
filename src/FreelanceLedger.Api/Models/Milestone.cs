using System.Text.Json.Serialization;

namespace FreelanceLedger.Api.Models;

public class Milestone
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [JsonIgnore]
    public Project Project { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Amount { get; set; }
    public Currency Currency { get; set; }
    public MilestoneStatus Status { get; set; }
    public DateOnly? DateDue { get; set; }
    public DateOnly? DatePaid { get; set; }
    public int SortOrder { get; set; }
}
