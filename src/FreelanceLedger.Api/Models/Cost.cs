namespace FreelanceLedger.Api.Models;

public class Cost
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public CostCategory Category { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public bool Recurring { get; set; }
    public string? Notes { get; set; }
}
