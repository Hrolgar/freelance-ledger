using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
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
        if (rate.Currency != project.Currency)
            return Problem(title: "Currency Mismatch", detail: $"This project is billed in {project.Currency}; every rate and logged period must be too.", statusCode: 400);

        var categoryFailure = await NormalizeCategoryAsync(projectId, rate);
        if (categoryFailure is not null)
            return categoryFailure;

        // One rate per category per effective date. Two categories may well start on the
        // same day -- that is exactly how a second rate gets introduced.
        var clash = await db.ProjectRates
            .AnyAsync(r => r.ProjectId == projectId && r.EffectiveFrom == rate.EffectiveFrom && r.Category == rate.Category);
        if (clash)
            return Problem(
                title: "Duplicate Effective Date",
                detail: $"This project already has a{CategoryClause(rate.Category)} rate effective from {rate.EffectiveFrom:yyyy-MM-dd}. Edit that one instead.",
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
        var project = await db.Projects.AsNoTracking().FirstAsync(p => p.Id == projectId);
        if (updated.Currency != project.Currency)
            return Problem(title: "Currency Mismatch", detail: $"This project is billed in {project.Currency}; every rate and logged period must be too.", statusCode: 400);

        var categoryFailure = await NormalizeCategoryAsync(projectId, updated);
        if (categoryFailure is not null)
            return categoryFailure;

        var clash = await db.ProjectRates
            .AnyAsync(r => r.ProjectId == projectId && r.EffectiveFrom == updated.EffectiveFrom
                           && r.Category == updated.Category && r.Id != id);
        if (clash)
            return Problem(
                title: "Duplicate Effective Date",
                detail: $"This project already has a{CategoryClause(updated.Category)} rate effective from {updated.EffectiveFrom:yyyy-MM-dd}.",
                statusCode: 409);

        rate.Rate = updated.Rate;
        rate.Currency = updated.Currency;
        rate.EffectiveFrom = updated.EffectiveFrom;
        rate.Notes = updated.Notes;
        rate.Category = updated.Category;

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

    /// Trims the category and snaps it onto the spelling already used on this project,
    /// so "contracted out" typed on the second rate row joins the "Contracted out"
    /// history instead of starting a third category that differs only in case.
    private async Task<IActionResult?> NormalizeCategoryAsync(int projectId, ProjectRate rate)
    {
        rate.Category = RateResolutionService.NormalizeCategory(rate.Category);
        if (rate.Category is null)
            return null;

        if (rate.Category.Length > 60)
            return Problem(title: "Category Too Long", detail: "Keep the rate category under 60 characters; it prints on the invoice.", statusCode: 400);

        var existing = await db.ProjectRates
            .Where(r => r.ProjectId == projectId && r.Category != null)
            .Select(r => r.Category!)
            .Distinct()
            .ToListAsync();
        var match = existing.FirstOrDefault(c => RateResolutionService.SameCategory(c, rate.Category));
        if (match is not null)
            rate.Category = match;
        return null;
    }

    private static string CategoryClause(string? category) =>
        category is null ? "" : $" \"{category}\"";
}
