using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

/// Resolves which hourly rate was in force on a given date, and works out the shape
/// of a cadence period.
public class RateResolutionService(LedgerDbContext db)
{
    /// The rate row with the greatest EffectiveFrom on or before the date, within one
    /// rate category (null = the project's default rate). A rate effective from
    /// 2026-09-01 does not apply to a period starting 2026-08-31, and a "Contracted out"
    /// rate never prices an in-house period however recent it is.
    public async Task<ProjectRate?> ResolveAsync(int projectId, DateOnly onDate, string? category = null)
    {
        category = NormalizeCategory(category);
        // Case-insensitive on the category: SQLite's default collation is not, and
        // "contracted out" typed on a period must find the "Contracted out" history.
        var wanted = category?.ToUpperInvariant();
        return await db.ProjectRates
            .AsNoTracking()
            .Where(r => r.ProjectId == projectId && r.EffectiveFrom <= onDate)
            .Where(r => wanted == null ? r.Category == null : r.Category != null && r.Category.ToUpper() == wanted)
            .OrderByDescending(r => r.EffectiveFrom)
            .ThenByDescending(r => r.Id)
            .FirstOrDefaultAsync();
    }

    /// Categories are free text typed by hand, so "In-house " and "in-house" must be the
    /// same category or the second one silently gets no rate. Trimmed, blank becomes
    /// null (the default rate); case is kept as typed because it prints on the invoice.
    public static string? NormalizeCategory(string? category)
    {
        var trimmed = category?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    /// Case-insensitive category equality, for matching a typed category against the
    /// ones already on the project.
    public static bool SameCategory(string? a, string? b) =>
        string.Equals(NormalizeCategory(a), NormalizeCategory(b), StringComparison.OrdinalIgnoreCase);

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
