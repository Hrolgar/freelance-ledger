using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/time-entries")]
public class TimeEntriesController(LedgerDbContext db, RateResolutionService rates) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        int projectId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] bool? unbilledOnly)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var query = db.TimeEntries.AsNoTracking().Where(t => t.ProjectId == projectId);

        // Overlap, not containment -- a period straddling the boundary still counts.
        if (from.HasValue)
            query = query.Where(t => t.PeriodEnd >= from.Value);
        if (to.HasValue)
            query = query.Where(t => t.PeriodStart <= to.Value);
        if (unbilledOnly == true)
            query = query.Where(t => t.InvoiceMilestoneId == null);

        var entries = await query.OrderBy(t => t.PeriodStart).ToListAsync();
        return Ok(entries);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int projectId, int id)
    {
        var entry = await db.TimeEntries
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.ProjectId == projectId);

        if (entry is null)
            return Problem(title: "Not Found", detail: $"Time entry {id} not found.", statusCode: 404);

        return Ok(entry);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int projectId, TimeEntry entry)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        FillInPeriod(project, entry);

        var failure = await ValidateAsync(project, entry, excludeId: null);
        if (failure is not null)
            return failure;

        entry.ProjectId = projectId;
        entry.InvoiceMilestoneId = null; // never created pre-billed
        db.TimeEntries.Add(entry);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { projectId, id = entry.Id }, entry);
    }

    /// Fill in the committed hours for every cadence period between two dates, skipping
    /// periods already logged. Lets a retainer be caught up in one call instead of one
    /// POST per week.
    [HttpPost("generate")]
    public async Task<IActionResult> Generate(int projectId, [FromBody] GenerateRequest request)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        if (project.Cadence == HoursCadence.None)
            return Problem(
                title: "No Cadence",
                detail: "This project has no weekly or monthly cadence set, so there is nothing to generate. Set a cadence and committed hours first.",
                statusCode: 400);

        var hours = request.Hours ?? project.CommittedHours;
        if (hours is null or <= 0)
            return Problem(
                title: "No Committed Hours",
                detail: "Set committedHours on the project, or pass hours in the request.",
                statusCode: 400);

        if (request.To < request.From)
            return Problem(title: "Invalid Range", detail: "'to' is before 'from'.", statusCode: 400);

        // A mistyped year would otherwise silently create thousands of rows against
        // real financial data. Two years of weeks is well past any sane catch-up.
        const int maxPeriods = 120;
        var periodCount = RateResolutionService
            .PeriodsBetween(project.Cadence, request.From, request.To).Take(maxPeriods + 1).Count();
        if (periodCount > maxPeriods)
            return Problem(
                title: "Range Too Wide",
                detail: $"That range covers more than {maxPeriods} periods. Narrow it down.",
                statusCode: 400);

        var existing = await db.TimeEntries
            .Where(t => t.ProjectId == projectId)
            .Select(t => new { t.PeriodStart, t.PeriodEnd })
            .ToListAsync();

        var created = new List<TimeEntry>();
        var skipped = new List<string>();

        foreach (var (start, end) in RateResolutionService.PeriodsBetween(
                     project.Cadence, request.From, request.To))
        {
            if (existing.Any(e => e.PeriodStart <= end && e.PeriodEnd >= start))
            {
                skipped.Add($"{start:yyyy-MM-dd}");
                continue;
            }

            var rate = await rates.ResolveAsync(projectId, start);
            if (rate is null)
            {
                skipped.Add($"{start:yyyy-MM-dd} (no rate in force)");
                continue;
            }

            var entry = new TimeEntry
            {
                ProjectId = projectId,
                PeriodStart = start,
                PeriodEnd = end,
                Hours = hours.Value,
                RateApplied = rate.Rate,
                Currency = rate.Currency,
                Notes = request.Notes,
            };
            db.TimeEntries.Add(entry);
            created.Add(entry);
            existing.Add(new { entry.PeriodStart, entry.PeriodEnd });
        }

        await db.SaveChangesAsync();
        return Ok(new { created = created.Count, skipped, entries = created });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int projectId, int id, TimeEntry updated)
    {
        var entry = await db.TimeEntries
            .FirstOrDefaultAsync(t => t.Id == id && t.ProjectId == projectId);

        if (entry is null)
            return Problem(title: "Not Found", detail: $"Time entry {id} not found.", statusCode: 404);

        if (entry.InvoiceMilestoneId is not null)
            return Problem(
                title: "Already Invoiced",
                detail: "This period has been invoiced. Delete the invoice first if it needs changing.",
                statusCode: 409);

        var project = await db.Projects.FirstAsync(p => p.Id == projectId);
        FillInPeriod(project, updated);

        var failure = await ValidateAsync(project, updated, excludeId: id);
        if (failure is not null)
            return failure;

        entry.PeriodStart = updated.PeriodStart;
        entry.PeriodEnd = updated.PeriodEnd;
        entry.Hours = updated.Hours;
        entry.Notes = updated.Notes;
        entry.RateApplied = updated.RateApplied;
        entry.Currency = updated.Currency;

        await db.SaveChangesAsync();
        return Ok(entry);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var entry = await db.TimeEntries
            .FirstOrDefaultAsync(t => t.Id == id && t.ProjectId == projectId);

        if (entry is null)
            return Problem(title: "Not Found", detail: $"Time entry {id} not found.", statusCode: 404);

        if (entry.InvoiceMilestoneId is not null)
            return Problem(
                title: "Already Invoiced",
                detail: "This period has been invoiced. Delete the invoice first if it needs removing.",
                statusCode: 409);

        db.TimeEntries.Remove(entry);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// Fills in the end date when the caller gave only a start. With a cadence that
    /// means the whole week or month the start falls in; without one it means a single
    /// day, which is how an hourly project with no cadence gets logged. Leaving it at
    /// the DateOnly default put 0001-01-01 in front of the validator, which then
    /// rejected the entry as ending before it started.
    private static void FillInPeriod(Project project, TimeEntry entry)
    {
        if (entry.PeriodEnd != default)
            return;

        var snapped = RateResolutionService.PeriodContaining(project.Cadence, entry.PeriodStart);
        (entry.PeriodStart, entry.PeriodEnd) = snapped ?? (entry.PeriodStart, entry.PeriodStart);
    }

    /// Shared rules for create and update. Mutates `entry` to snapshot the rate.
    private async Task<IActionResult?> ValidateAsync(Project project, TimeEntry entry, int? excludeId)
    {
        if (entry.Hours <= 0)
            return Problem(title: "Invalid Hours", detail: "Hours must be greater than zero.", statusCode: 400);

        // There are 744 hours in the longest month. A figure past this is a typo, and
        // a typo here becomes an invoice sent to a client.
        if (entry.Hours > 744)
            return Problem(
                title: "Implausible Hours",
                detail: $"{entry.Hours:0.##} hours in one period is more than there are hours in a month. Check the figure.",
                statusCode: 400);

        if (entry.PeriodEnd < entry.PeriodStart)
            return Problem(
                title: "Invalid Period",
                detail: "periodEnd is before periodStart.",
                statusCode: 400);

        if (entry.RateApplied <= 0)
        {
            var rate = await rates.ResolveAsync(project.Id, entry.PeriodStart);
            if (rate is null)
                return Problem(
                    title: "No Rate In Force",
                    detail: $"No hourly rate is effective on or before {entry.PeriodStart:yyyy-MM-dd} for this project. Add a rate first, or supply rateApplied explicitly.",
                    statusCode: 400);

            entry.RateApplied = rate.Rate;
            entry.Currency = rate.Currency;
        }

        var overlap = await db.TimeEntries
            .Where(t => t.ProjectId == project.Id && (excludeId == null || t.Id != excludeId))
            .Where(t => t.PeriodStart <= entry.PeriodEnd && t.PeriodEnd >= entry.PeriodStart)
            .FirstOrDefaultAsync();

        if (overlap is not null)
            return Problem(
                title: "Overlapping Period",
                detail: $"This overlaps the period {overlap.PeriodStart:yyyy-MM-dd} to {overlap.PeriodEnd:yyyy-MM-dd}, which is already logged. Edit that one instead.",
                statusCode: 409);

        return null;
    }
}

public record GenerateRequest(DateOnly From, DateOnly To, decimal? Hours, string? Notes);
