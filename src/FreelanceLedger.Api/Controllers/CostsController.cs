using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/costs")]
public class CostsController(LedgerDbContext db) : ControllerBase
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
            {
                // One-time: must match exactly
                return c.Month == month && c.Year == year;
            }

            // Recurring: must have started on or before this month
            if (startKey > queryKey) return false;

            // If no end date, it's still active
            if (!c.EndMonth.HasValue || !c.EndYear.HasValue) return true;

            // Check end date
            var endKey = c.EndYear.Value * 12 + c.EndMonth.Value;
            return queryKey <= endKey;
        })
        .OrderBy(c => c.Recurring ? 0 : 1)
        .ThenBy(c => c.Description)
        .ToList();

        return Ok(effective);
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
