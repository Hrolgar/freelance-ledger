using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/retainer")]
public class RetainerController(LedgerDbContext db, RateResolutionService rates) : ControllerBase
{
    public record PeriodDto(
        DateOnly PeriodStart,
        DateOnly PeriodEnd,
        decimal? Fee,
        Currency? Currency,
        int? InvoiceMilestoneId,
        string? InvoiceNumber,
        MilestoneStatus? Status);

    /// Which fee applies to which month, and whether that month is already invoiced.
    /// Derived, never stored, so the frontend never has to re-derive it and drift from
    /// what the server would say.
    [HttpGet("periods")]
    public async Task<IActionResult> GetPeriods(int projectId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var project = await db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rangeFrom = from ?? project.DateAwarded ?? today.AddMonths(-12);
        var rangeTo = to ?? today;

        // A retainer invoice is always raised for a whole calendar month, so the period
        // it covers is an exact key -- but the project's billing type could have
        // changed over its life, so group defensively rather than assume one invoice
        // per period start.
        var invoicesByStart = (await db.Milestones
                .AsNoTracking()
                .Where(m => m.ProjectId == projectId && m.InvoiceNumber != null && m.PeriodStart != null)
                .ToListAsync())
            .GroupBy(m => m.PeriodStart!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.Id).First());

        var result = new List<PeriodDto>();
        foreach (var (start, end) in RateResolutionService.PeriodsBetween(HoursCadence.Monthly, rangeFrom, rangeTo))
        {
            var rate = await rates.ResolveAsync(projectId, start);
            invoicesByStart.TryGetValue(start, out var invoice);
            result.Add(new PeriodDto(
                start, end,
                rate?.Rate, rate?.Currency,
                invoice?.Id, invoice?.InvoiceNumber, invoice?.Status));
        }

        return Ok(result);
    }
}
