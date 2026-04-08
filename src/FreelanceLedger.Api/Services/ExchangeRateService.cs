using System.Text.Json;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

public class ExchangeRateService(LedgerDbContext db, HttpClient http)
{
    private static readonly Currency[] TrackedCurrencies =
        [Currency.GBP, Currency.USD, Currency.EUR, Currency.CAD, Currency.INR];

    /// <summary>
    /// Gets the NOK rate for a currency in a given month.
    /// Auto-fetches from frankfurter.app if missing.
    /// </summary>
    public async Task<decimal> GetRate(Currency currency, int month, int year)
    {
        if (currency == Currency.NOK) return 1m;

        var existing = await db.ExchangeRates
            .FirstOrDefaultAsync(r => r.Currency == currency && r.Month == month && r.Year == year);

        if (existing is not null) return existing.Rate;

        // Fetch and store all currencies for this month
        await FetchAndStoreRates(month, year);

        var fetched = await db.ExchangeRates
            .FirstOrDefaultAsync(r => r.Currency == currency && r.Month == month && r.Year == year);

        return fetched?.Rate ?? 0m;
    }

    /// <summary>
    /// Ensures rates exist for a given month. Returns true if rates were fetched.
    /// </summary>
    public async Task<bool> EnsureRatesExist(int month, int year)
    {
        var count = await db.ExchangeRates
            .CountAsync(r => r.Month == month && r.Year == year);

        if (count >= TrackedCurrencies.Length) return false;

        await FetchAndStoreRates(month, year);
        return true;
    }

    private async Task FetchAndStoreRates(int month, int year)
    {
        // For current/future months, use latest rates
        // For past months, use the last business day of that month
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        string dateStr;

        if (year > today.Year || (year == today.Year && month >= today.Month))
        {
            dateStr = "latest";
        }
        else
        {
            // Last day of the month
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
