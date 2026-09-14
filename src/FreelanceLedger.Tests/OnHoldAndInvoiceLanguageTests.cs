using System.Globalization;
using System.Net.Http;
using FreelanceLedger.Api.Controllers;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FreelanceLedger.Tests;

public sealed class OnHoldAndInvoiceLanguageTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly LedgerDbContext _db;
    private readonly InvoiceDocumentService _docs;

    public OnHoldAndInvoiceLanguageTests()
    {
        _connection.Open();
        var options = new DbContextOptionsBuilder<LedgerDbContext>().UseSqlite(_connection).Options;
        _db = new LedgerDbContext(options);
        _db.Database.EnsureCreated();
        _docs = new InvoiceDocumentService(_db, NullLogger<InvoiceDocumentService>.Instance);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task OnHoldProjectIsExcludedFromPipelineButCountedSeparately()
    {
        var onHold = new Project
        {
            ClientName = "Held Co",
            ProjectName = "Paused Project",
            Currency = Currency.NOK,
            Status = ProjectStatus.OnHold,
        };
        var active = new Project
        {
            ClientName = "Active Co",
            ProjectName = "Active Project",
            Currency = Currency.NOK,
            Status = ProjectStatus.InProgress,
        };
        _db.Projects.AddRange(onHold, active);
        await _db.SaveChangesAsync();

        _db.Milestones.AddRange(
            new Milestone
            {
                ProjectId = onHold.Id,
                Name = "M1",
                Amount = 5000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Pending,
            },
            new Milestone
            {
                ProjectId = active.Id,
                Name = "M1",
                Amount = 3000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Pending,
            });
        await _db.SaveChangesAsync();

        var controller = new DashboardController(_db, new ExchangeRateService(_db, new HttpClient()));
        var response = await controller.GetPipeline();

        var ok = Assert.IsType<OkObjectResult>(response);
        var payload = Assert.IsType<PipelineResponse>(ok.Value);

        Assert.DoesNotContain(payload.Projects, p => p.ProjectId == onHold.Id);
        Assert.Contains(payload.Projects, p => p.ProjectId == active.Id);
        Assert.Equal(1, payload.OnHoldCount);
    }

    private async Task<(Project Project, Milestone Invoice)> AddVatInvoiceAsync(InvoiceLanguage? language)
    {
        var project = new Project
        {
            ClientName = "NO Client",
            ProjectName = "NO Project",
            Currency = Currency.NOK,
            BillingType = BillingType.Retainer,
            Status = ProjectStatus.InProgress,
            VatRate = 25m,
            InvoiceLanguage = language,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        _db.InvoiceProfiles.Add(new InvoiceProfile
        {
            IssuerName = "Helgi Skjortnes",
            OrgNumber = "123 456 789",
            VatNote = "Reverse charge applies; no VAT charged.",
        });

        var invoice = new Milestone
        {
            ProjectId = project.Id,
            Name = "Invoice",
            Amount = 10000m,
            Currency = Currency.NOK,
            Status = MilestoneStatus.Pending,
            InvoiceNumber = "OC-2026-001",
            InvoiceDate = new DateOnly(2026, 9, 1),
            VatRate = 25m,
            VatAmount = 2500m,
            PeriodStart = new DateOnly(2026, 8, 1),
            PeriodEnd = new DateOnly(2026, 8, 31),
        };
        _db.Milestones.Add(invoice);
        await _db.SaveChangesAsync();

        return (project, invoice);
    }

    [Fact]
    public async Task VatInvoiceWithAutomaticLanguageRendersNorwegian()
    {
        var (project, invoice) = await AddVatInvoiceAsync(language: null);

        var markdown = await _docs.BuildMarkdownAsync(project.Id, invoice.Id);
        Assert.NotNull(markdown);

        var nbNo = CultureInfo.GetCultureInfo("nb-NO");
        Assert.Contains("MVA 25 %", markdown);
        Assert.Contains($"kr {2500m.ToString("N2", nbNo)}", markdown);
        Assert.Contains("Å betale", markdown);
        Assert.Contains($"kr {12500m.ToString("N2", nbNo)}", markdown);
        Assert.Contains("Org.nr. 123 456 789 MVA", markdown);
    }

    [Fact]
    public async Task VatInvoiceWithEnglishOverrideRendersEnglishAndOmitsVatNote()
    {
        var (project, invoice) = await AddVatInvoiceAsync(language: InvoiceLanguage.English);

        var markdown = await _docs.BuildMarkdownAsync(project.Id, invoice.Id);
        Assert.NotNull(markdown);

        Assert.Contains("VAT 25 %", markdown);
        Assert.Contains("Total due", markdown);
        Assert.DoesNotContain("Reverse charge applies; no VAT charged.", markdown);
    }
}
