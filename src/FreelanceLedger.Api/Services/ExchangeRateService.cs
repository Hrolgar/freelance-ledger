using System.Collections.Concurrent;
using System.Text.Json;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

public class ExchangeRateService(LedgerDbContext db, HttpClient http, ILogger<ExchangeRateService> logger)
{
    public static readonly Currency[] TrackedCurrencies =
        [Currency.GBP, Currency.USD, Currency.EUR, Currency.CAD, Currency.INR];

    // In-memory rate cache: "GBP-3-2026" -> rate.
    // ConcurrentDictionary because Dashboard fires GetYearOverview + GetPipeline in parallel,
    // both call PreloadYear which mutates this cache.
    private static readonly ConcurrentDictionary<string, decimal> _rateCache = new();

    // Months whose fetch failed recently, so a dashboard load does not hammer a
    // provider that is down. "3-2026" -> when it failed.
    private static readonly ConcurrentDictionary<string, DateTime> _failedFetches = new();
    private static readonly TimeSpan FailureCooldown = TimeSpan.FromMinutes(30);

    private static string Key(Currency currency, int month, int year) => $"{currency}-{month}-{year}";

    /// <summary>
    /// Gets the NOK rate for a currency in a given month.
    /// Uses in-memory cache, falls back to DB. Returns 0 if not available.
    /// Does NOT auto-fetch from external API — use EnsureRatesExist / EnsureYearAsync for that.
    /// </summary>
    public async Task<decimal> GetRate(Currency currency, int month, int year)
    {
        if (currency == Currency.NOK) return 1m;

        var key = Key(currency, month, year);
        if (_rateCache.TryGetValue(key, out var cached))
            return cached;

        var existing = await db.ExchangeRates
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Currency == currency && r.Month == month && r.Year == year);

        if (existing is not null)
        {
            _rateCache[key] = existing.Rate;
            return existing.Rate;
        }

        return 0m;
    }

    /// True when a rate is on file (or the currency is NOK). The dashboard uses this to
    /// say "no rate for USD in March" instead of quietly multiplying by zero.
    public async Task<bool> HasRate(Currency currency, int month, int year)
        => currency == Currency.NOK || await GetRate(currency, month, year) != 0m;

    /// <summary>
    /// Preload all rates for a year into the in-memory cache in one DB query.
    /// Call this before loops that need many rate lookups.
    /// </summary>
    public async Task PreloadYear(int year)
    {
        var rates = await db.ExchangeRates
            .AsNoTracking()
            .Where(r => r.Year == year)
            .ToListAsync();

        foreach (var r in rates)
            _rateCache[Key(r.Currency, r.Month, r.Year)] = r.Rate;
    }

    /// The cache is process-wide and used to outlive every edit: correcting a rate in
    /// Settings, or a re-fetch updating a row, left the old figure in the totals until
    /// the container restarted. Every write path calls one of these.
    public static void Invalidate(Currency currency, int month, int year)
        => _rateCache.TryRemove(Key(currency, month, year), out _);

    public static void InvalidateAll() => _rateCache.Clear();

    /// Fetches every past month of the year that is missing a rate, so a year overview
    /// never depends on someone having pressed a button in Settings. Cheap when nothing
    /// is missing (one COUNT per month), throttled when the provider is down.
    public async Task EnsureYearAsync(int year)
    {
        var today = Clock.Today;
        if (year > today.Year) return;
        var lastMonth = year == today.Year ? today.Month : 12;
        for (var month = 1; month <= lastMonth; month++)
            await EnsureRatesExist(month, year);
    }

    // Track last fetch time to avoid hammering the API
    private static DateTime _lastCurrentMonthFetch = DateTime.MinValue;

    /// <summary>
    /// Ensures rates exist for a given month. Returns true if rates were fetched.
    /// Will not fetch for future months. Current month uses today's rate (cached 24h).
    /// </summary>
    public async Task<bool> EnsureRatesExist(int month, int year)
    {
        var today = Clock.Today;

        // Don't fetch for future months
        if (year > today.Year || (year == today.Year && month > today.Month))
            return false;

        var count = await db.ExchangeRates
            .CountAsync(r => r.Month == month && r.Year == year);

        var isCurrentMonth = year == today.Year && month == today.Month;
        if (count >= TrackedCurrencies.Length)
        {
            // Past months: rates are final
            if (!isCurrentMonth)
                return false;

            // Current month: only re-fetch once per 24h
            if ((DateTime.UtcNow - _lastCurrentMonthFetch).TotalHours < 24)
                return false;
        }

        var failKey = $"{month}-{year}";
        if (_failedFetches.TryGetValue(failKey, out var failedAt) && DateTime.UtcNow - failedAt < FailureCooldown)
            return false;

        var ok = await FetchAndStoreRates(month, year);
        if (ok)
        {
            _failedFetches.TryRemove(failKey, out _);
            // Stamp the throttle on success only: a failed fetch used to be treated as
            // "done for 24 hours", so one outage hid today's rate for a day.
            if (isCurrentMonth)
                _lastCurrentMonthFetch = DateTime.UtcNow;
        }
        else
        {
            _failedFetches[failKey] = DateTime.UtcNow;
        }

        return ok;
    }

    private async Task<bool> FetchAndStoreRates(int month, int year)
    {
        var today = Clock.Today;
        string dateStr;

        if (year == today.Year && month == today.Month)
        {
            // Current month: use today's rate (will update on next request)
            dateStr = "latest";
        }
        else
        {
            // Past month: use the last business day of that month (final rate)
            var lastDay = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
            dateStr = lastDay.ToString("yyyy-MM-dd");
        }

        try
        {
            var url = dateStr == "latest"
                ? "https://api.frankfurter.dev/v1/latest?base=NOK"
                : $"https://api.frankfurter.dev/v1/{dateStr}?base=NOK";

            var response = await http.GetStringAsync(url);
            using var doc = JsonDocument.Parse(response);
            if (!doc.RootElement.TryGetProperty("rates", out var rates))
            {
                logger.LogWarning("Exchange rate provider returned no rates for {Month}/{Year}", month, year);
                return false;
            }

            var stored = 0;
            foreach (var currency in TrackedCurrencies)
            {
                var code = currency.ToString();
                if (!rates.TryGetProperty(code, out var rateElement)) continue;
                if (!rateElement.TryGetDecimal(out var foreignPerNok)) continue;

                // The provider says how much foreign currency one NOK buys. A rate that is
                // zero, negative or absurd (one NOK worth more than a thousand of anything,
                // or less than a thousandth) is a provider glitch, not a market move, and
                // must not reach the books.
                if (foreignPerNok <= 0m) continue;
                var nokPerForeign = Math.Round(1m / foreignPerNok, 4);
                if (nokPerForeign is <= 0.001m or >= 1000m) continue;

                var existing = await db.ExchangeRates
                    .FirstOrDefaultAsync(r => r.Currency == currency && r.Month == month && r.Year == year);

                if (existing is not null)
                {
                    existing.Rate = nokPerForeign;
                }
                else
                {
                    db.ExchangeRates.Add(new ExchangeRate
                    {
                        Currency = currency,
                        Month = month,
                        Year = year,
                        Rate = nokPerForeign
                    });
                }
                Invalidate(currency, month, year);
                stored++;
            }

            await db.SaveChangesAsync();
            return stored > 0;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            // Provider unavailable, slow, or talking nonsense: rates stay missing and the
            // caller reports them as missing. Never a 500 out of a Settings button.
            logger.LogWarning(ex, "Exchange rate fetch failed for {Month}/{Year}", month, year);
            return false;
        }
    }
}
