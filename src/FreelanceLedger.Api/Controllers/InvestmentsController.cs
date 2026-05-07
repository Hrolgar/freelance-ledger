using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/investments")]
public class InvestmentsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? year)
    {
        var query = db.Investments.AsNoTracking().AsQueryable();

        if (year.HasValue)
            query = query.Where(i => i.Year == year.Value);

        var investments = await query
            .OrderByDescending(i => i.Year)
            .ThenByDescending(i => i.Month)
            .ThenBy(i => i.Description)
            .ToListAsync();

        return Ok(investments);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var investment = await db.Investments.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id);
        if (investment is null)
            return Problem(title: "Not Found", detail: $"Investment {id} not found.", statusCode: 404);

        return Ok(investment);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Investment investment)
    {
        db.Investments.Add(investment);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = investment.Id }, investment);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Investment updated)
    {
        var investment = await db.Investments.FindAsync(id);
        if (investment is null)
            return Problem(title: "Not Found", detail: $"Investment {id} not found.", statusCode: 404);

        investment.Description = updated.Description;
        investment.Amount = updated.Amount;
        investment.Currency = updated.Currency;
        investment.NokRate = updated.NokRate;
        investment.Month = updated.Month;
        investment.Year = updated.Year;
        investment.Notes = updated.Notes;
        investment.Category = updated.Category;

        await db.SaveChangesAsync();
        return Ok(investment);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var investment = await db.Investments.FindAsync(id);
        if (investment is null)
            return Problem(title: "Not Found", detail: $"Investment {id} not found.", statusCode: 404);

        db.Investments.Remove(investment);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
