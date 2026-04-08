using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/costs")]
public class CostsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? month, [FromQuery] int? year)
    {
        var query = db.Costs.AsNoTracking().AsQueryable();

        if (month.HasValue)
            query = query.Where(c => c.Month == month.Value);

        if (year.HasValue)
            query = query.Where(c => c.Year == year.Value);

        var costs = await query
            .OrderByDescending(c => c.Year)
            .ThenByDescending(c => c.Month)
            .ThenBy(c => c.Description)
            .ToListAsync();

        return Ok(costs);
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
