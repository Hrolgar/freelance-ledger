namespace FreelanceLedger.Api.Models;

public class Project
{
    public int Id { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public Platform Platform { get; set; }
    public Currency Currency { get; set; }
    public decimal FeePercentage { get; set; }
    public ProjectStatus Status { get; set; }
    public DateOnly? DateAwarded { get; set; }
    public DateOnly? DateCompleted { get; set; }
    public string? Notes { get; set; }

    public ICollection<Milestone> Milestones { get; set; } = [];
    public ICollection<Tip> Tips { get; set; } = [];
}
