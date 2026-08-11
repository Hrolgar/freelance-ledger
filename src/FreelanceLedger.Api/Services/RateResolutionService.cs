using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

/// Resolves which hourly rate was in force on a given date, and works out the shape
/// of a cadence period.
public class RateResolutionService(LedgerDbContext db)
{
    /// The rate row with the greatest EffectiveFrom on or before the date. A rate
    /// effective from 2026-09-01 does not apply to a period starting 2026-08-31.
    public async Task<ProjectRate?> ResolveAsync(int projectId, DateOnly onDate)
    {
        return await db.ProjectRates
            .AsNoTracking()
            .Where(r => r.ProjectId == projectId && r.EffectiveFrom <= onDate)
            .OrderByDescending(r => r.EffectiveFrom)
            .ThenByDescending(r => r.Id)
            .FirstOrDefaultAsync();
    }

    /// Monday of the week containing the date.
    public static DateOnly MondayOf(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7; // Sunday(0) -> 6, Monday(1) -> 0
        return date.AddDays(-offset);
    }

    /// The period containing the given date for a cadence: Monday-Sunday for weekly,
    /// 1st-to-last for monthly. Returns null for HoursCadence.None, which has no
    /// natural period.
    public static (DateOnly Start, DateOnly End)? PeriodContaining(
        HoursCadence cadence, DateOnly date)
    {
        switch (cadence)
        {
            case HoursCadence.Weekly:
                var monday = MondayOf(date);
                return (monday, monday.AddDays(6));
            case HoursCadence.Monthly:
                var first = new DateOnly(date.Year, date.Month, 1);
                return (first, first.AddMonths(1).AddDays(-1));
            default:
                return null;
        }
    }

    /// Walks cadence periods from `from` up to and including the period containing
    /// `to`. Used to fill in a stretch of committed hours in one go.
    public static IEnumerable<(DateOnly Start, DateOnly End)> PeriodsBetween(
        HoursCadence cadence, DateOnly from, DateOnly to)
    {
        var current = PeriodContaining(cadence, from);
        if (current is null)
            yield break;

        var period = current.Value;
        while (period.Start <= to)
        {
            yield return period;
            var next = cadence == HoursCadence.Weekly
                ? period.Start.AddDays(7)
                : period.Start.AddMonths(1);
            period = PeriodContaining(cadence, next)!.Value;
        }
    }
}
