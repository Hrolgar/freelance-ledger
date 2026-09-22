namespace FreelanceLedger.Api.Services;

/// "Today" for a business that lives in Norway. Every date the ledger stamps on its own
/// (invoice date, paid date, the retainer sweep's month, "is this due yet") used to come
/// from DateTime.UtcNow, which is yesterday between midnight and 02:00 in Oslo: an
/// invoice raised at 00:30 on the 1st printed the last day of the previous month and its
/// revenue landed in the wrong month. Falls back to UTC only if the zone is missing.
public static class Clock
{
    private static readonly TimeZoneInfo Oslo = Resolve();

    private static TimeZoneInfo Resolve()
    {
        foreach (var id in new[] { "Europe/Oslo", "W. Europe Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }

    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Oslo);
    public static DateOnly Today => DateOnly.FromDateTime(Now);
}
