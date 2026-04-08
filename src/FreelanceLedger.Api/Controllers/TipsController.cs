using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId}/tips")]
public class TipsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var tips = await db.Tips
            .Where(t => t.ProjectId == projectId)
            .OrderByDescending(t => t.Date)
            .ToListAsync();

        return Ok(tips);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int projectId, int id)
    {
        var tip = await db.Tips.FirstOrDefaultAsync(t => t.Id == id && t.ProjectId == projectId);
        if (tip is null)
            return Problem(title: "Not Found", detail: $"Tip {id} not found.", statusCode: 404);

        return Ok(tip);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int projectId, Tip tip)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

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
