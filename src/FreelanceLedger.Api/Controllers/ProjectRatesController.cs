using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/rates")]
public class ProjectRatesController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var rates = await db.ProjectRates
            .AsNoTracking()
            .Where(r => r.ProjectId == projectId)
            .OrderByDescending(r => r.EffectiveFrom)
            .ToListAsync();

        return Ok(rates);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int projectId, int id)
    {
        var rate = await db.ProjectRates
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id && r.ProjectId == projectId);

        if (rate is null)
            return Problem(title: "Not Found", detail: $"Rate {id} not found.", statusCode: 404);

        return Ok(rate);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int projectId, ProjectRate rate)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        if (rate.Rate <= 0)
            return Problem(title: "Invalid Rate", detail: "Rate must be greater than zero.", statusCode: 400);

        var clash = await db.ProjectRates
            .AnyAsync(r => r.ProjectId == projectId && r.EffectiveFrom == rate.EffectiveFrom);
        if (clash)
            return Problem(
                title: "Duplicate Effective Date",
                detail: $"This project already has a rate effective from {rate.EffectiveFrom:yyyy-MM-dd}. Edit that one instead.",
                statusCode: 409);

        rate.ProjectId = projectId;
        db.ProjectRates.Add(rate);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { projectId, id = rate.Id }, rate);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int projectId, int id, ProjectRate updated)
    {
        var rate = await db.ProjectRates
            .FirstOrDefaultAsync(r => r.Id == id && r.ProjectId == projectId);

        if (rate is null)
            return Problem(title: "Not Found", detail: $"Rate {id} not found.", statusCode: 404);

        if (updated.Rate <= 0)
            return Problem(title: "Invalid Rate", detail: "Rate must be greater than zero.", statusCode: 400);

        var clash = await db.ProjectRates
            .AnyAsync(r => r.ProjectId == projectId && r.EffectiveFrom == updated.EffectiveFrom && r.Id != id);
        if (clash)
            return Problem(
                title: "Duplicate Effective Date",
                detail: $"This project already has a rate effective from {updated.EffectiveFrom:yyyy-MM-dd}.",
                statusCode: 409);

        rate.Rate = updated.Rate;
        rate.Currency = updated.Currency;
        rate.EffectiveFrom = updated.EffectiveFrom;
        rate.Notes = updated.Notes;

        await db.SaveChangesAsync();
        return Ok(rate);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var rate = await db.ProjectRates
            .FirstOrDefaultAsync(r => r.Id == id && r.ProjectId == projectId);

        if (rate is null)
            return Problem(title: "Not Found", detail: $"Rate {id} not found.", statusCode: 404);

        db.ProjectRates.Remove(rate);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
