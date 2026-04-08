namespace FreelanceLedger.Api.Models;

public class Cost
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public Currency Currency { get; set; }
    public CostCategory Category { get; set; }
    public bool Recurring { get; set; }

    // For one-time costs: the specific month/year
    // For recurring costs: when it starts
    public int Month { get; set; }
    public int Year { get; set; }

    // For recurring costs: when it ends (null = still active)
    public int? EndMonth { get; set; }
    public int? EndYear { get; set; }

    public string? Notes { get; set; }
}
