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

    public record PeriodsResponse(DateOnly? FirstMonth, List<PeriodDto> Months);

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
        var endOfThisMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(1).AddDays(-1);

        // The retainer starts when its first fee starts. A month before the first fee
        // has no rate to invoice against and is noise, not history.
        var firstRate = await db.ProjectRates
            .AsNoTracking()
            .Where(r => r.ProjectId == projectId)
            .OrderBy(r => r.EffectiveFrom)
            .ThenBy(r => r.Id)
            .FirstOrDefaultAsync();
        var firstMonth = firstRate is not null
            ? new DateOnly(firstRate.EffectiveFrom.Year, firstRate.EffectiveFrom.Month, 1)
            : (DateOnly?)null;

        var rangeFrom = from ?? firstMonth ?? project.DateAwarded ?? new DateOnly(today.Year, today.Month, 1);
        var rangeTo = to is { } explicitTo && explicitTo < endOfThisMonth ? explicitTo : endOfThisMonth;

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

        var months = new List<PeriodDto>();
        foreach (var (start, end) in RateResolutionService.PeriodsBetween(HoursCadence.Monthly, rangeFrom, rangeTo))
        {
            var rate = await rates.ResolveAsync(projectId, start);
            invoicesByStart.TryGetValue(start, out var invoice);
            months.Add(new PeriodDto(
                start, end,
                rate?.Rate, rate?.Currency,
                invoice?.Id, invoice?.InvoiceNumber, invoice?.Status));
        }

        return Ok(new PeriodsResponse(firstMonth, months));
    }
}
