using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/costs")]
public class CostsController(LedgerDbContext db, ExchangeRateService rateService) : ControllerBase
{
    /// <summary>
    /// Get all cost definitions (for the Costs management page).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var costs = await db.Costs.AsNoTracking()
            .OrderBy(c => c.Recurring ? 0 : 1)
            .ThenByDescending(c => c.Year)
            .ThenByDescending(c => c.Month)
            .ThenBy(c => c.Description)
            .ToListAsync();

        return Ok(costs);
    }

    /// <summary>
    /// Get effective costs for a specific month — one-time costs in that month
    /// plus recurring costs that are active during that month.
    /// Amounts are returned in both original currency and NOK.
    /// </summary>
    [HttpGet("effective")]
    public async Task<IActionResult> GetEffective([FromQuery] int month, [FromQuery] int year)
    {
        var allCosts = await db.Costs.AsNoTracking().ToListAsync();

        var effective = allCosts.Where(c =>
        {
            var startKey = c.Year * 12 + c.Month;
            var queryKey = year * 12 + month;

            if (!c.Recurring)
                return c.Month == month && c.Year == year;

            if (startKey > queryKey) return false;
            if (!c.EndMonth.HasValue || !c.EndYear.HasValue) return true;

            var endKey = c.EndYear.Value * 12 + c.EndMonth.Value;
            return queryKey <= endKey;
        })
        .OrderBy(c => c.Recurring ? 0 : 1)
        .ThenBy(c => c.Description)
        .ToList();

        var results = new List<EffectiveCostResponse>();
        foreach (var c in effective)
        {
            var rate = await rateService.GetRate(c.Currency, month, year);
            var amountNok = Math.Round(c.Amount * rate, 2);
            results.Add(new EffectiveCostResponse(
                c.Id, c.Description, c.Amount, c.Currency, amountNok,
                c.Category, c.Recurring, c.Month, c.Year,
                c.EndMonth, c.EndYear, c.Notes));
        }

        return Ok(results);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var cost = await db.Costs.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (cost is null)
            return Problem(title: "Not Found", detail: $"Cost {id} not found.", statusCode: 404);

        return Ok(cost);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Cost cost)
    {
        db.Costs.Add(cost);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = cost.Id }, cost);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Cost updated)
    {
        var cost = await db.Costs.FindAsync(id);
        if (cost is null)
            return Problem(title: "Not Found", detail: $"Cost {id} not found.", statusCode: 404);

        cost.Description = updated.Description;
        cost.Amount = updated.Amount;
        cost.Currency = updated.Currency;
        cost.Category = updated.Category;
        cost.Month = updated.Month;
        cost.Year = updated.Year;
        cost.Recurring = updated.Recurring;
        cost.EndMonth = updated.EndMonth;
        cost.EndYear = updated.EndYear;
        cost.Notes = updated.Notes;

        await db.SaveChangesAsync();
        return Ok(cost);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var cost = await db.Costs.FindAsync(id);
        if (cost is null)
            return Problem(title: "Not Found", detail: $"Cost {id} not found.", statusCode: 404);

        db.Costs.Remove(cost);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record EffectiveCostResponse(
    int Id,
    string Description,
    decimal Amount,
    Currency Currency,
    decimal AmountNok,
    CostCategory Category,
    bool Recurring,
    int Month,
    int Year,
    int? EndMonth,
    int? EndYear,
    string? Notes);
