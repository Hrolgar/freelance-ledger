using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects")]
public class ProjectsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var projects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Client)
            .Include(p => p.Platform)
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .ToListAsync();

        return Ok(projects);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var project = await db.Projects
            .AsNoTracking()
            .Include(p => p.Client)
            .Include(p => p.Platform)
            .Include(p => p.Milestones.OrderBy(m => m.SortOrder))
            .Include(p => p.Tips)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        return Ok(project);
    }

    [HttpGet("{id}/summary")]
    public async Task<IActionResult> GetSummary(int id)
    {
        var project = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        var paidMilestoneTotal = project.Milestones
            .Where(m => m.Status == MilestoneStatus.Paid)
            .Sum(m => m.Amount);

        var tipTotal = project.Tips.Sum(t => t.Amount);

        var gross = paidMilestoneTotal + tipTotal;
        var fee = gross * (project.FeePercentage / 100m);
        var net = gross - fee;

        var pipelineTotal = project.Milestones.Sum(m => m.Amount) + tipTotal;
        var outstanding = pipelineTotal - paidMilestoneTotal - tipTotal;
        var outstandingNet = outstanding - (outstanding * project.FeePercentage / 100m);

        return Ok(new ProjectSummaryResponse(
            id,
            paidMilestoneTotal,
            tipTotal,
            gross,
            fee,
            net,
            pipelineTotal,
            outstanding,
            outstandingNet,
            project.InitialFullPrice,
            project.Currency));
    }

    [HttpPost]
    public async Task<IActionResult> Create(Project project)
    {
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Project updated)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        project.ClientName = updated.ClientName;
        project.ProjectName = updated.ProjectName;
        project.PlatformId = updated.PlatformId;
        project.Currency = updated.Currency;
        project.FeePercentage = updated.FeePercentage;
        project.InitialFullPrice = updated.InitialFullPrice;
        project.Status = updated.Status;
        project.DateAwarded = updated.DateAwarded;
        project.DateCompleted = updated.DateCompleted;
        project.Notes = updated.Notes;

        await db.SaveChangesAsync();
        return Ok(project);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        db.Projects.Remove(project);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record ProjectSummaryResponse(
    int ProjectId,
    decimal PaidMilestoneTotal,
    decimal TipTotal,
    decimal Gross,
    decimal Fee,
    decimal Net,
    decimal PipelineTotal,
    decimal Outstanding,
    decimal OutstandingNet,
    decimal? InitialFullPrice,
    Currency Currency);
