namespace FreelanceLedger.Api.Models;

public class ExchangeRate
{
    public int Id { get; set; }
    public Currency Currency { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal Rate { get; set; }
}
