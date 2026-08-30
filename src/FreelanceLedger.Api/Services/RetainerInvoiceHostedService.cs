using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

/// Raises last month's retainer invoice automatically, once a day, for every project
/// with AutoRaiseInvoice set. Modelled on BackupHostedService: initial delay, loop,
/// try/catch around the actual work so one bad run logs and the timer survives.
///
/// This creates financial records unattended, so every raise is logged at
/// Information -- the journal is the only trace an invoice appeared on its own.
public class RetainerInvoiceHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<RetainerInvoiceHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromMinutes(3), ct);

        while (!ct.IsCancellationRequested)
        {
            try { await RaisePastMonth(); }
            catch (Exception ex) { logger.LogError(ex, "Automatic retainer raise failed"); }

            try { await Task.Delay(TimeSpan.FromHours(24), ct); }
            catch (TaskCanceledException) { return; }
        }
    }

    private async Task RaisePastMonth()
    {
        // RetainerInvoiceService is scoped and this hosted service is a singleton, so a
        // scope is created per run -- the same pattern Program.cs uses around the
        // startup migration.
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>();
        var retainer = scope.ServiceProvider.GetRequiredService<RetainerInvoiceService>();

        // Always the most recently completed calendar month. The overlap guard inside
        // RaiseAsync makes repeating this every day within the same month a no-op once
        // that month is raised, so a restart or a second run the same day raises
        // nothing extra.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var thisMonthStart = new DateOnly(today.Year, today.Month, 1);
        var periodStart = thisMonthStart.AddMonths(-1);
        var periodEnd = thisMonthStart.AddDays(-1);

        var projects = await db.Projects
            .Where(p => p.BillingType == BillingType.Retainer
                        && p.AutoRaiseInvoice
                        && (p.Status == ProjectStatus.InProgress || p.Status == ProjectStatus.Awarded))
            .ToListAsync();

        foreach (var project in projects)
        {
            try
            {
                var result = await retainer.RaiseAsync(project, periodStart, periodEnd);
                switch (result.Status)
                {
                    case RetainerInvoiceService.RaiseStatus.Ok:
                        logger.LogInformation(
                            "Automatic retainer invoice raised: project {ProjectId} ({ProjectName}), period {PeriodStart} to {PeriodEnd}, invoice {InvoiceNumber}",
                            project.Id, project.ProjectName, periodStart, periodEnd, result.Invoice!.InvoiceNumber);
                        break;
                    case RetainerInvoiceService.RaiseStatus.PeriodOverlap:
                        // Already raised this month -- expected on a restart or a
                        // second run the same day, not worth logging every time.
                        break;
                    default:
                        logger.LogWarning(
                            "Automatic retainer invoice skipped: project {ProjectId} ({ProjectName}): {Detail}",
                            project.Id, project.ProjectName, result.Detail);
                        break;
                }
            }
            catch (Exception ex)
            {
                // One project's failure must not stop the rest from being raised.
                logger.LogError(ex, "Automatic retainer invoice failed for project {ProjectId}", project.Id);
            }
        }
    }
}
