namespace FreelanceLedger.Api.Models;

public class Investment
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public Currency Currency { get; set; }
    public decimal NokRate { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public string? Notes { get; set; }
    public InvestmentCategory Category { get; set; } = InvestmentCategory.Other;
}
