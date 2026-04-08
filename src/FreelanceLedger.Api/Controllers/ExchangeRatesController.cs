using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExchangeRatesController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? month, [FromQuery] int? year)
    {
        var query = db.ExchangeRates.AsQueryable();

        if (month.HasValue)
            query = query.Where(r => r.Month == month.Value);

        if (year.HasValue)
            query = query.Where(r => r.Year == year.Value);

        var rates = await query.OrderBy(r => r.Year).ThenBy(r => r.Month).ThenBy(r => r.Currency).ToListAsync();
        return Ok(rates);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var rate = await db.ExchangeRates.FindAsync(id);
        if (rate is null)
            return Problem(title: "Not Found", detail: $"ExchangeRate {id} not found.", statusCode: 404);

        return Ok(rate);
    }

    [HttpPost]
    public async Task<IActionResult> Create(ExchangeRate rate)
    {
        db.ExchangeRates.Add(rate);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = rate.Id }, rate);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, ExchangeRate updated)
    {
        var rate = await db.ExchangeRates.FindAsync(id);
        if (rate is null)
            return Problem(title: "Not Found", detail: $"ExchangeRate {id} not found.", statusCode: 404);

        rate.Currency = updated.Currency;
        rate.Month = updated.Month;
        rate.Year = updated.Year;
        rate.Rate = updated.Rate;

        await db.SaveChangesAsync();
        return Ok(rate);
    }

    // Upsert: create or update by currency+month+year
    [HttpPut("upsert")]
    public async Task<IActionResult> Upsert(ExchangeRate incoming)
    {
        var existing = await db.ExchangeRates.FirstOrDefaultAsync(r =>
            r.Currency == incoming.Currency &&
            r.Month == incoming.Month &&
            r.Year == incoming.Year);

        if (existing is null)
        {
            db.ExchangeRates.Add(incoming);
            await db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = incoming.Id }, incoming);
        }

        existing.Rate = incoming.Rate;
        await db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var rate = await db.ExchangeRates.FindAsync(id);
        if (rate is null)
            return Problem(title: "Not Found", detail: $"ExchangeRate {id} not found.", statusCode: 404);

        db.ExchangeRates.Remove(rate);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
