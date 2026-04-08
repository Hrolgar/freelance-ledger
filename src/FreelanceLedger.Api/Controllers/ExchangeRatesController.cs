using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/exchange-rates")]
public class ExchangeRatesController(LedgerDbContext db, ExchangeRateService rateService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? month, [FromQuery] int? year)
    {
        var query = db.ExchangeRates.AsNoTracking().AsQueryable();

        if (month.HasValue)
            query = query.Where(r => r.Month == month.Value);

        if (year.HasValue)
            query = query.Where(r => r.Year == year.Value);

        var rates = await query
            .OrderByDescending(r => r.Year)
            .ThenByDescending(r => r.Month)
            .ThenBy(r => r.Currency)
            .ToListAsync();

        return Ok(rates);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var rate = await db.ExchangeRates.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
        if (rate is null)
            return Problem(title: "Not Found", detail: $"Exchange rate {id} not found.", statusCode: 404);

        return Ok(rate);
    }

    [HttpPost]
    public async Task<IActionResult> Create(ExchangeRate exchangeRate)
    {
        db.ExchangeRates.Add(exchangeRate);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = exchangeRate.Id }, exchangeRate);
    }

    [HttpPut]
    public async Task<IActionResult> Upsert(ExchangeRate exchangeRate)
    {
        var existing = await db.ExchangeRates.FirstOrDefaultAsync(r =>
            r.Currency == exchangeRate.Currency &&
            r.Month == exchangeRate.Month &&
            r.Year == exchangeRate.Year);

        if (existing is null)
        {
            db.ExchangeRates.Add(exchangeRate);
            await db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = exchangeRate.Id }, exchangeRate);
        }

        existing.Rate = exchangeRate.Rate;
        await db.SaveChangesAsync();
        return Ok(existing);
    }

    /// <summary>
    /// Auto-fetch rates for a given month from frankfurter.app.
    /// If rates already exist, they are updated.
    /// </summary>
    [HttpPost("auto-fetch")]
    public async Task<IActionResult> AutoFetch([FromQuery] int month, [FromQuery] int year)
    {
        await rateService.EnsureRatesExist(month, year);

        var rates = await db.ExchangeRates
            .AsNoTracking()
            .Where(r => r.Month == month && r.Year == year)
            .OrderBy(r => r.Currency)
            .ToListAsync();

        return Ok(rates);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var rate = await db.ExchangeRates.FindAsync(id);
        if (rate is null)
            return Problem(title: "Not Found", detail: $"Exchange rate {id} not found.", statusCode: 404);

        db.ExchangeRates.Remove(rate);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
