using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/milestones")]
public class MilestonesController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var milestones = await db.Milestones
            .AsNoTracking()
            .Include(m => m.Project)
            .Where(m => m.ProjectId == projectId)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        return Ok(milestones);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int projectId, int id)
    {
        var milestone = await db.Milestones
            .AsNoTracking()
            .Include(m => m.Project)
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        return Ok(milestone);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int projectId, Milestone milestone)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        milestone.ProjectId = projectId;
        db.Milestones.Add(milestone);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { projectId, id = milestone.Id }, milestone);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int projectId, int id, Milestone updated)
    {
        var milestone = await db.Milestones
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        milestone.Name = updated.Name;
        milestone.Description = updated.Description;
        milestone.Amount = updated.Amount;
        milestone.Currency = updated.Currency;
        milestone.Status = updated.Status;
        milestone.DateDue = updated.DateDue;
        milestone.DatePaid = updated.DatePaid;
        milestone.SortOrder = updated.SortOrder;

        await db.SaveChangesAsync();
        return Ok(milestone);
    }

    [HttpPatch("~/api/milestones/{id:int}")]
    public async Task<IActionResult> Patch(int id, [FromBody] MilestonePatchRequest patch)
    {
        var milestone = await db.Milestones.FindAsync(id);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        if (patch.Status.HasValue)
            milestone.Status = patch.Status.Value;

        if (patch.DatePaid.HasValue)
            milestone.DatePaid = patch.DatePaid.Value;

        await db.SaveChangesAsync();
        return Ok(milestone);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var milestone = await db.Milestones
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        db.Milestones.Remove(milestone);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record MilestonePatchRequest(MilestoneStatus? Status, DateOnly? DatePaid);
