using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/tips")]
public class TipsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var projectExists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var tips = await db.Tips
            .AsNoTracking()
            .Include(t => t.Project)
            .Where(t => t.ProjectId == projectId)
            .OrderByDescending(t => t.Date)
            .ToListAsync();

        return Ok(tips);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int projectId, int id)
    {
        var tip = await db.Tips
            .AsNoTracking()
            .Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id && t.ProjectId == projectId);

        if (tip is null)
            return Problem(title: "Not Found", detail: $"Tip {id} not found.", statusCode: 404);

        return Ok(tip);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int projectId, Tip tip)
    {
        var project = await db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);
        if (tip.Currency != project.Currency)
            return Problem(title: "Currency Mismatch", detail: $"This project is billed in {project.Currency}.", statusCode: 400);
        if (tip.Amount < 0)
            return Problem(title: "Invalid Amount", detail: "Amount cannot be negative.", statusCode: 400);

        tip.Id = 0;
        tip.ProjectId = projectId;
        db.Tips.Add(tip);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { projectId, id = tip.Id }, tip);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int projectId, int id, Tip updated)
    {
        var tip = await db.Tips.FirstOrDefaultAsync(t => t.Id == id && t.ProjectId == projectId);
        if (tip is null)
            return Problem(title: "Not Found", detail: $"Tip {id} not found.", statusCode: 404);

        var project = await db.Projects.AsNoTracking().FirstAsync(p => p.Id == projectId);
        if (updated.Currency != project.Currency)
            return Problem(title: "Currency Mismatch", detail: $"This project is billed in {project.Currency}.", statusCode: 400);
        if (updated.Amount < 0)
            return Problem(title: "Invalid Amount", detail: "Amount cannot be negative.", statusCode: 400);

        tip.Amount = updated.Amount;
        tip.Currency = updated.Currency;
        tip.Date = updated.Date;
        tip.Notes = updated.Notes;

        await db.SaveChangesAsync();
        return Ok(tip);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var tip = await db.Tips.FirstOrDefaultAsync(t => t.Id == id && t.ProjectId == projectId);
        if (tip is null)
            return Problem(title: "Not Found", detail: $"Tip {id} not found.", statusCode: 404);

        db.Tips.Remove(tip);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
