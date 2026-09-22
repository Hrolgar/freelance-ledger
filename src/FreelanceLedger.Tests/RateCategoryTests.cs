using FreelanceLedger.Api.Controllers;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace FreelanceLedger.Tests;

/// A project can bill more than one kind of work at different hourly rates (OC: in-house
/// at one rate, work charged on to their customer at another). The rate category is
/// what picks the rate, keeps the overlap rule per kind of work, and splits the invoice
/// into one line per category. A project with a single, uncategorised rate must behave
/// exactly as it did before categories existed.
public class RateCategoryTests : IDisposable
{
    private readonly RetainerFixture _fixture = new();
    private LedgerDbContext Db => _fixture.Db;

    public void Dispose() => _fixture.Dispose();

    private TimeEntriesController Entries => new(Db, _fixture.Rates);
    private ProjectRatesController RatesApi => new(Db);
    private InvoicesController Invoices =>
        new(Db, _fixture.Docs, _fixture.Files, _fixture.InvoiceNumbers, _fixture.Retainer);

    private async Task<Project> AddHourlyProjectAsync()
    {
        var project = new Project
        {
            ClientName = "Outside Communications",
            ProjectName = "OC",
            Currency = Currency.USD,
            BillingType = BillingType.Hourly,
            Status = ProjectStatus.InProgress,
            InvoicePrefix = "OC",
            InvoiceLineLabel = "Engineering services, hourly",
        };
        Db.Projects.Add(project);
        await Db.SaveChangesAsync();
        return project;
    }

    private async Task AddRateAsync(int projectId, decimal rate, string? category, string from = "2026-06-01")
    {
        var result = await RatesApi.Create(projectId, new ProjectRate
        {
            Rate = rate,
            Currency = Currency.USD,
            EffectiveFrom = DateOnly.Parse(from),
            Category = category,
        });
        Assert.IsType<CreatedAtActionResult>(result);
    }

    private static int StatusOf(IActionResult result) => result switch
    {
        ObjectResult o => o.StatusCode ?? 200,
        StatusCodeResult s => s.StatusCode,
        _ => 200,
    };

    private static string DetailOf(IActionResult result) =>
        ((ProblemDetails)((ObjectResult)result).Value!).Detail ?? "";

    [Fact]
    public async Task Each_category_resolves_its_own_rate_and_an_unknown_one_has_none()
    {
        var project = await AddHourlyProjectAsync();
        await AddRateAsync(project.Id, 60, null);
        await AddRateAsync(project.Id, 100, "Contracted out", "2026-09-01");

        var day = DateOnly.Parse("2026-09-15");
        Assert.Equal(60m, (await _fixture.Rates.ResolveAsync(project.Id, day))!.Rate);
        Assert.Equal(100m, (await _fixture.Rates.ResolveAsync(project.Id, day, "Contracted out"))!.Rate);
        Assert.Equal(100m, (await _fixture.Rates.ResolveAsync(project.Id, day, "  contracted OUT "))?.Rate ?? 0m,
            precision: 2);
        Assert.Null(await _fixture.Rates.ResolveAsync(project.Id, day, "Something else"));
        // The contracted-out rate starts in September; August in that category has no rate.
        Assert.Null(await _fixture.Rates.ResolveAsync(project.Id, DateOnly.Parse("2026-08-15"), "Contracted out"));
    }

    [Fact]
    public async Task Same_day_in_two_categories_is_two_entries_but_one_category_still_cannot_overlap()
    {
        var project = await AddHourlyProjectAsync();
        await AddRateAsync(project.Id, 60, null);
        await AddRateAsync(project.Id, 100, "Contracted out");
        var day = DateOnly.Parse("2026-09-15");

        var inHouse = await Entries.Create(project.Id, new TimeEntry { PeriodStart = day, Hours = 3 });
        Assert.Equal(201, StatusOf(inHouse));
        var contracted = await Entries.Create(project.Id, new TimeEntry { PeriodStart = day, Hours = 2, Category = "contracted out" });
        Assert.Equal(201, StatusOf(contracted));

        var saved = ((TimeEntry)((CreatedAtActionResult)contracted).Value!);
        Assert.Equal("Contracted out", saved.Category); // snapped onto the rate's spelling
        Assert.Equal(100m, saved.RateApplied);

        var duplicate = await Entries.Create(project.Id, new TimeEntry { PeriodStart = day, Hours = 1, Category = "Contracted out" });
        Assert.Equal(409, StatusOf(duplicate));
        Assert.Contains("\"Contracted out\"", DetailOf(duplicate));

        var duplicateDefault = await Entries.Create(project.Id, new TimeEntry { PeriodStart = day, Hours = 1 });
        Assert.Equal(409, StatusOf(duplicateDefault));
    }

    [Fact]
    public async Task A_category_with_no_rate_is_refused_with_the_category_named()
    {
        var project = await AddHourlyProjectAsync();
        await AddRateAsync(project.Id, 60, null);

        var result = await Entries.Create(project.Id, new TimeEntry
        {
            PeriodStart = DateOnly.Parse("2026-09-15"), Hours = 2, Category = "Contracted out",
        });
        Assert.Equal(400, StatusOf(result));
        Assert.Contains("\"Contracted out\" rate", DetailOf(result));
    }

    [Fact]
    public async Task Editing_an_entry_into_another_category_reprices_it()
    {
        var project = await AddHourlyProjectAsync();
        await AddRateAsync(project.Id, 60, null);
        await AddRateAsync(project.Id, 100, "Contracted out");
        var day = DateOnly.Parse("2026-09-15");

        var created = (TimeEntry)((CreatedAtActionResult)await Entries.Create(
            project.Id, new TimeEntry { PeriodStart = day, Hours = 3 })).Value!;
        Assert.Equal(60m, created.RateApplied);

        var updated = await Entries.Update(project.Id, created.Id, new TimeEntry
        {
            PeriodStart = day, PeriodEnd = day, Hours = 3, Category = "Contracted out",
        });
        Assert.Equal(200, StatusOf(updated));
        var entry = (TimeEntry)((OkObjectResult)updated).Value!;
        Assert.Equal(100m, entry.RateApplied);
        Assert.Equal("Contracted out", entry.Category);
    }

    [Fact]
    public async Task Two_rates_may_start_the_same_day_in_different_categories_but_not_in_one()
    {
        var project = await AddHourlyProjectAsync();
        await AddRateAsync(project.Id, 60, null);
        await AddRateAsync(project.Id, 100, "Contracted out");

        var clash = await RatesApi.Create(project.Id, new ProjectRate
        {
            Rate = 120, Currency = Currency.USD, EffectiveFrom = DateOnly.Parse("2026-06-01"), Category = "contracted out",
        });
        Assert.Equal(409, StatusOf(clash));
    }

    [Fact]
    public async Task Invoice_prints_one_line_per_category_and_a_single_category_prints_as_before()
    {
        var project = await AddHourlyProjectAsync();
        await AddRateAsync(project.Id, 60, null);
        await AddRateAsync(project.Id, 100, "Contracted out");

        Assert.Equal(201, StatusOf(await Entries.Create(project.Id, new TimeEntry { PeriodStart = DateOnly.Parse("2026-09-01"), Hours = 4 })));
        Assert.Equal(201, StatusOf(await Entries.Create(project.Id, new TimeEntry { PeriodStart = DateOnly.Parse("2026-09-02"), Hours = 2 })));
        Assert.Equal(201, StatusOf(await Entries.Create(project.Id, new TimeEntry { PeriodStart = DateOnly.Parse("2026-09-02"), Hours = 3, Category = "Contracted out" })));

        var raised = await Invoices.Create(project.Id, new CreateInvoiceRequest(
            DateOnly.Parse("2026-09-01"), DateOnly.Parse("2026-09-30"), null, null, null, null, DateOnly.Parse("2026-10-01")));
        Assert.Equal(201, StatusOf(raised));
        var invoice = Db.Milestones.Single(m => m.InvoiceNumber != null);
        Assert.Equal(6 * 60m + 3 * 100m, invoice.Amount);
        Assert.Equal(9m, invoice.Hours);
        Assert.Null(invoice.RateApplied); // mixed rates: the lines carry the detail

        var markdown = await _fixture.Docs.BuildMarkdownAsync(project.Id, invoice.Id);
        Assert.NotNull(markdown);
        Assert.Contains("| Engineering services, hourly | 6 | USD 60.00 | USD 360.00 |", markdown);
        Assert.Contains("| Contracted out | 3 | USD 100.00 | USD 300.00 |", markdown);
        Assert.Contains("**USD 660.00**", markdown);

        // A second invoice with only in-house work reads exactly as the old single line.
        Assert.Equal(201, StatusOf(await Entries.Create(project.Id, new TimeEntry { PeriodStart = DateOnly.Parse("2026-10-03"), Hours = 5 })));
        var second = await Invoices.Create(project.Id, new CreateInvoiceRequest(
            DateOnly.Parse("2026-10-01"), DateOnly.Parse("2026-10-31"), null, null, null, null, DateOnly.Parse("2026-11-01")));
        Assert.Equal(201, StatusOf(second));
        var secondInvoice = Db.Milestones.Single(m => m.InvoiceNumber != null && m.Id != invoice.Id);
        var secondMarkdown = await _fixture.Docs.BuildMarkdownAsync(project.Id, secondInvoice.Id);
        Assert.Contains("| Engineering services, hourly | 5 | USD 60.00 | USD 300.00 |", secondMarkdown);
        Assert.DoesNotContain("Contracted out", secondMarkdown);
        Assert.Equal(60m, secondInvoice.RateApplied);
    }
}
