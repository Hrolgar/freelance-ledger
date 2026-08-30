using FreelanceLedger.Api.Controllers;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FreelanceLedger.Tests;

/// A live (open) SQLite connection backing an in-memory database, torn down with the
/// test. EF Core's SQLite in-memory database only exists for as long as one connection
/// to it stays open, which is also what lets RetainerInvoiceService's real transactions
/// and unique-index behaviour run exactly as they do against the file-backed database.
public sealed class RetainerFixture : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    public LedgerDbContext Db { get; }
    public RateResolutionService Rates { get; }
    public InvoiceNumberService InvoiceNumbers { get; }
    public InvoiceDocumentService Docs { get; }
    public ProjectFileStore Files { get; }
    public RetainerInvoiceService Retainer { get; }

    public RetainerFixture()
    {
        _connection.Open();
        var options = new DbContextOptionsBuilder<LedgerDbContext>().UseSqlite(_connection).Options;
        Db = new LedgerDbContext(options);
        Db.Database.EnsureCreated();

        Rates = new RateResolutionService(Db);
        InvoiceNumbers = new InvoiceNumberService(Db);
        Docs = new InvoiceDocumentService(Db, NullLogger<InvoiceDocumentService>.Instance);
        Files = new ProjectFileStore(Db, new ConfigurationBuilder().Build(), NullLogger<ProjectFileStore>.Instance);
        Retainer = new RetainerInvoiceService(Db, Rates, InvoiceNumbers, Docs, Files);
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
    }
}

public class RetainerAndVatTests : IDisposable
{
    private readonly RetainerFixture _fixture = new();
    private LedgerDbContext Db => _fixture.Db;

    public void Dispose() => _fixture.Dispose();

    private async Task<Project> AddRetainerProjectAsync(decimal? vatRate)
    {
        var project = new Project
        {
            ClientName = "Test Client",
            ProjectName = "Test Retainer",
            Currency = Currency.NOK,
            BillingType = BillingType.Retainer,
            Status = ProjectStatus.InProgress,
            VatRate = vatRate,
        };
        Db.Projects.Add(project);
        await Db.SaveChangesAsync();
        return project;
    }

    private async Task AddRateAsync(int projectId, decimal rate, DateOnly effectiveFrom)
    {
        Db.ProjectRates.Add(new ProjectRate
        {
            ProjectId = projectId,
            Rate = rate,
            Currency = Currency.NOK,
            EffectiveFrom = effectiveFrom,
        });
        await Db.SaveChangesAsync();
    }

    [Fact]
    public async Task VatIsComputedOnceAndAmountStaysNet()
    {
        var project = await AddRetainerProjectAsync(vatRate: 25m);
        await AddRateAsync(project.Id, 10000m, new DateOnly(2026, 8, 1));

        var result = await _fixture.Retainer.RaiseAsync(
            project, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));

        Assert.Equal(RetainerInvoiceService.RaiseStatus.Ok, result.Status);
        Assert.Equal(10000m, result.Invoice!.Amount);
        Assert.Equal(25m, result.Invoice.VatRate);
        Assert.Equal(2500m, result.Invoice.VatAmount);
        Assert.Equal(12500m, result.Invoice.TotalDue);
    }

    [Fact]
    public async Task NoVatRateProducesNullVatAndPrintsVatNoteWithSingleTotalRow()
    {
        var project = await AddRetainerProjectAsync(vatRate: null);
        await AddRateAsync(project.Id, 8000m, new DateOnly(2026, 8, 1));
        Db.InvoiceProfiles.Add(new InvoiceProfile
        {
            IssuerName = "Helgi Skjortnes",
            VatNote = "No VAT is charged; reverse charge applies.",
        });
        await Db.SaveChangesAsync();

        var result = await _fixture.Retainer.RaiseAsync(
            project, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));

        Assert.Equal(RetainerInvoiceService.RaiseStatus.Ok, result.Status);
        Assert.Null(result.Invoice!.VatRate);
        Assert.Null(result.Invoice.VatAmount);

        var markdown = await _fixture.Docs.BuildMarkdownAsync(project.Id, result.Invoice.Id);
        Assert.NotNull(markdown);
        Assert.Contains("No VAT is charged; reverse charge applies.", markdown);
        Assert.DoesNotContain("Subtotal", markdown);
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(markdown, "Total due"));
    }

    [Fact]
    public async Task RaisingTheSameMonthTwiceReturns409AndCreatesOneInvoice()
    {
        var project = await AddRetainerProjectAsync(vatRate: null);
        await AddRateAsync(project.Id, 5000m, new DateOnly(2026, 8, 1));

        var first = await _fixture.Retainer.RaiseAsync(
            project, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));
        var second = await _fixture.Retainer.RaiseAsync(
            project, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));

        Assert.Equal(RetainerInvoiceService.RaiseStatus.Ok, first.Status);
        Assert.Equal(RetainerInvoiceService.RaiseStatus.PeriodOverlap, second.Status);

        var count = await Db.Milestones.CountAsync(m => m.ProjectId == project.Id);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task FeeIncreaseMidHistoryLeavesIssuedInvoiceUnchanged()
    {
        var project = await AddRetainerProjectAsync(vatRate: null);
        await AddRateAsync(project.Id, 5000m, new DateOnly(2026, 1, 1));

        var january = await _fixture.Retainer.RaiseAsync(
            project, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));
        Assert.Equal(5000m, january.Invoice!.Amount);

        // The raise is an INSERT with a future EffectiveFrom -- it must not touch the
        // invoice already issued for January.
        await AddRateAsync(project.Id, 6000m, new DateOnly(2026, 2, 1));

        var february = await _fixture.Retainer.RaiseAsync(
            project, new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28));
        Assert.Equal(6000m, february.Invoice!.Amount);

        var reloadedJanuary = await Db.Milestones.AsNoTracking().SingleAsync(m => m.Id == january.Invoice.Id);
        Assert.Equal(5000m, reloadedJanuary.Amount);
    }

    [Fact]
    public async Task VatInvoiceDocumentPrintsOneGrossTotalRowWhileAmountStaysNet()
    {
        var project = await AddRetainerProjectAsync(vatRate: 25m);
        await AddRateAsync(project.Id, 10000m, new DateOnly(2026, 8, 1));

        var result = await _fixture.Retainer.RaiseAsync(
            project, new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));
        Assert.Equal(RetainerInvoiceService.RaiseStatus.Ok, result.Status);

        var markdown = await _fixture.Docs.BuildMarkdownAsync(project.Id, result.Invoice!.Id);
        Assert.NotNull(markdown);
        Assert.DoesNotContain("Subtotal", markdown);
        Assert.DoesNotContain("VAT 25", markdown);
        Assert.Single(System.Text.RegularExpressions.Regex.Matches(markdown, "Total due"));
        Assert.Contains("Total due (inkl. VAT)", markdown);
        Assert.Contains("12,500.00", markdown);

        var reloaded = await Db.Milestones.AsNoTracking().SingleAsync(m => m.Id == result.Invoice.Id);
        Assert.Equal(10000m, reloaded.Amount);
        Assert.Equal(25m, reloaded.VatRate);
        Assert.Equal(2500m, reloaded.VatAmount);
    }

    [Fact]
    public async Task GetPeriodsDefaultsToFirstFeeMonthAndExcludesFutureMonths()
    {
        var project = await AddRetainerProjectAsync(vatRate: null);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var firstOfThisMonth = new DateOnly(today.Year, today.Month, 1);
        await AddRateAsync(project.Id, 5000m, firstOfThisMonth);

        var controller = new RetainerController(Db, _fixture.Rates);
        var response = await controller.GetPeriods(project.Id, from: null, to: null);

        var ok = Assert.IsType<OkObjectResult>(response);
        var payload = Assert.IsType<RetainerController.PeriodsResponse>(ok.Value);

        Assert.Equal(firstOfThisMonth, payload.FirstMonth);
        var month = Assert.Single(payload.Months);
        Assert.Equal(firstOfThisMonth, month.PeriodStart);
    }

    /// The year selector asks for a whole calendar year, so it hands in 1 January. Without
    /// the clamp that reintroduces the empty leading months the first-fee rule exists to
    /// remove -- rows with no fee, which can never be invoiced.
    [Fact]
    public async Task ExplicitFromIsClampedToTheFirstFeeMonth()
    {
        var project = await AddRetainerProjectAsync(vatRate: null);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var august = new DateOnly(today.Year, 8, 1);
        await AddRateAsync(project.Id, 12000m, august);

        var controller = new RetainerController(Db, _fixture.Rates);
        var response = await controller.GetPeriods(
            project.Id,
            from: new DateOnly(today.Year, 1, 1),
            to: new DateOnly(today.Year, 12, 31));

        var ok = Assert.IsType<OkObjectResult>(response);
        var payload = Assert.IsType<RetainerController.PeriodsResponse>(ok.Value);

        Assert.Equal(august, payload.FirstMonth);
        Assert.Equal(august, payload.Months[0].PeriodStart);
        Assert.DoesNotContain(payload.Months, m => m.PeriodStart < august);
        // And still nothing beyond the month we are actually in.
        Assert.DoesNotContain(payload.Months, m => m.PeriodStart > new DateOnly(today.Year, today.Month, 1));
    }

    [Fact]
    public async Task AutomaticRaisingIsIdempotentAcrossTwoRuns()
    {
        var project = await AddRetainerProjectAsync(vatRate: null);
        // Well in the past so it resolves no matter which "previous month" the clock
        // running the test lands on.
        await AddRateAsync(project.Id, 7500m, new DateOnly(2020, 1, 1));
        project.AutoRaiseInvoice = true;
        await Db.SaveChangesAsync();

        var services = new ServiceCollection();
        services.AddSingleton(_fixture.Db);
        services.AddSingleton(_fixture.Rates);
        services.AddSingleton(_fixture.InvoiceNumbers);
        services.AddSingleton(_fixture.Docs);
        services.AddSingleton(_fixture.Files);
        services.AddSingleton(_fixture.Retainer);
        services.AddSingleton(typeof(Microsoft.Extensions.Logging.ILogger<>), typeof(NullLogger<>));
        await using var provider = services.BuildServiceProvider();

        var hosted = new RetainerInvoiceHostedService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<RetainerInvoiceHostedService>.Instance);

        await hosted.RaisePastMonth();
        await hosted.RaisePastMonth();

        var count = await Db.Milestones.CountAsync(m => m.ProjectId == project.Id);
        Assert.Equal(1, count);
    }
}
