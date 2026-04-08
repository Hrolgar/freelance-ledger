using System.Text.Json;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

public class ExchangeRateService(LedgerDbContext db, HttpClient http)
{
    private static readonly Currency[] TrackedCurrencies =
        [Currency.GBP, Currency.USD, Currency.EUR, Currency.CAD, Currency.INR];

    // In-memory rate cache: "GBP-3-2026" -> rate
    private static readonly Dictionary<string, decimal> _rateCache = new();

    /// <summary>
    /// Gets the NOK rate for a currency in a given month.
    /// Uses in-memory cache, falls back to DB. Returns 0 if not available.
    /// Does NOT auto-fetch from external API — use EnsureRatesExist for that.
    /// </summary>
    public async Task<decimal> GetRate(Currency currency, int month, int year)
    {
        if (currency == Currency.NOK) return 1m;

        var key = $"{currency}-{month}-{year}";
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
            _rateCache[$"{r.Currency}-{r.Month}-{r.Year}"] = r.Rate;
    }

    // Track last fetch time to avoid hammering the API
    private static DateTime _lastCurrentMonthFetch = DateTime.MinValue;

    /// <summary>
    /// Ensures rates exist for a given month. Returns true if rates were fetched.
    /// Will not fetch for future months. Current month uses today's rate (cached 24h).
    /// </summary>
    public async Task<bool> EnsureRatesExist(int month, int year)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Don't fetch for future months
        if (year > today.Year || (year == today.Year && month > today.Month))
            return false;

        var count = await db.ExchangeRates
            .CountAsync(r => r.Month == month && r.Year == year);

        if (count >= TrackedCurrencies.Length)
        {
            // Past months: rates are final
            if (!(year == today.Year && month == today.Month))
                return false;

            // Current month: only re-fetch once per 24h
            if ((DateTime.UtcNow - _lastCurrentMonthFetch).TotalHours < 24)
                return false;
        }

        await FetchAndStoreRates(month, year);
        if (year == today.Year && month == today.Month)
            _lastCurrentMonthFetch = DateTime.UtcNow;

        return true;
    }

    private async Task FetchAndStoreRates(int month, int year)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
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
            var doc = JsonDocument.Parse(response);
            var rates = doc.RootElement.GetProperty("rates");

            foreach (var currency in TrackedCurrencies)
            {
                var code = currency.ToString();
                if (!rates.TryGetProperty(code, out var rateElement)) continue;

                var foreignPerNok = rateElement.GetDecimal();
                if (foreignPerNok == 0) continue;

                // API returns how much foreign currency per 1 NOK
                // We want how much NOK per 1 foreign currency
                var nokPerForeign = Math.Round(1m / foreignPerNok, 4);

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
            }

            await db.SaveChangesAsync();
        }
        catch (HttpRequestException)
        {
            // API unavailable — rates stay missing, caller handles 0
        }
    }
}
