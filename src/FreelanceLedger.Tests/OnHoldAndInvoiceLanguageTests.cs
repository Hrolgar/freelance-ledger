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
        // OnHold but fully paid: has money, but none of it is unpaid, so it must not
        // count towards OnHoldCount -- that field means "on hold AND still owed money".
        var onHoldSettled = new Project
        {
            ClientName = "Settled Co",
            ProjectName = "Settled Project",
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
        _db.Projects.AddRange(onHold, onHoldSettled, active);
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
                ProjectId = onHoldSettled.Id,
                Name = "M1",
                Amount = 4000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Paid,
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
        Assert.DoesNotContain(payload.Projects, p => p.ProjectId == onHoldSettled.Id);
        Assert.Contains(payload.Projects, p => p.ProjectId == active.Id);
        // Only the on-hold project with unpaid money counts -- the settled one does not.
        Assert.Equal(1, payload.OnHoldCount);
        // NOK rate is always 1 and fee is 0 here, so the remaining project's unpaid net
        // (3000) is the whole pipeline value.
        Assert.Equal(3000m, payload.TotalPipelineValue);
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
            AccountHolder = "Helgi Skjortnes",
            Iban = "NO93 8601 1117 947",
            PaymentNotes = "Wire transfer only, no checks accepted.",
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

        Assert.Contains("MVA 25 %", markdown);
        // Literal expected strings, not built with the same nb-NO culture the code
        // uses to format them -- an independent check of the actual output shape.
        // "kr 12 000,00" uses U+00A0 (no-break space) as the thousands separator.
        Assert.Contains("kr 2 500,00", markdown);
        Assert.Contains("Å betale", markdown);
        Assert.Contains("kr 12 500,00", markdown);
        Assert.Contains("Org.nr. 123 456 789 MVA", markdown);
        Assert.Contains("1. september 2026", markdown);

        // profile.VatNote explains why no VAT is charged -- this invoice charges VAT,
        // so it must never appear.
        Assert.DoesNotContain("Reverse charge applies; no VAT charged.", markdown);

        // PaymentNotesNorwegian is blank on this profile, so the Norwegian document
        // must print nothing in its place -- in particular not the English PaymentNotes.
        Assert.DoesNotContain("Wire transfer only, no checks accepted.", markdown);
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

    [Fact]
    public async Task OldInvoiceWithNoVatStaysEnglishAfterProjectVatRateLaterRises()
    {
        // The project now charges VAT, but this invoice was raised before that and
        // froze VatRate = null. Automatic language must follow the INVOICE's own
        // VatRate, not the project's current one, so re-downloading it still
        // reproduces the English document that was actually sent.
        var project = new Project
        {
            ClientName = "NO Client",
            ProjectName = "NO Project",
            Currency = Currency.NOK,
            BillingType = BillingType.Retainer,
            Status = ProjectStatus.InProgress,
            VatRate = 25m,
            InvoiceLanguage = null,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        _db.InvoiceProfiles.Add(new InvoiceProfile { IssuerName = "Helgi Skjortnes" });

        var invoice = new Milestone
        {
            ProjectId = project.Id,
            Name = "Invoice",
            Amount = 10000m,
            Currency = Currency.NOK,
            Status = MilestoneStatus.Pending,
            InvoiceNumber = "OC-2026-002",
            InvoiceDate = new DateOnly(2026, 1, 1),
            VatRate = null,
            PeriodStart = new DateOnly(2025, 12, 1),
            PeriodEnd = new DateOnly(2025, 12, 31),
        };
        _db.Milestones.Add(invoice);
        await _db.SaveChangesAsync();

        var markdown = await _docs.BuildMarkdownAsync(project.Id, invoice.Id);
        Assert.NotNull(markdown);

        Assert.Contains("Total due", markdown);
        Assert.DoesNotContain("Å betale", markdown);
    }

    private async Task<(Project Project, Milestone Invoice)> AddNoVatNorwegianInvoiceAsync(string? vatNoteNorwegian)
    {
        var project = new Project
        {
            ClientName = "NO Client",
            ProjectName = "NO Project",
            Currency = Currency.NOK,
            BillingType = BillingType.Retainer,
            Status = ProjectStatus.InProgress,
            VatRate = null,
            InvoiceLanguage = InvoiceLanguage.Norwegian,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        _db.InvoiceProfiles.Add(new InvoiceProfile
        {
            IssuerName = "Helgi Skjortnes",
            VatNote = "English foreign note",
            VatNoteNorwegian = vatNoteNorwegian,
        });

        var invoice = new Milestone
        {
            ProjectId = project.Id,
            Name = "Invoice",
            Amount = 10000m,
            Currency = Currency.NOK,
            Status = MilestoneStatus.Pending,
            InvoiceNumber = "OC-2026-003",
            InvoiceDate = new DateOnly(2026, 9, 1),
            VatRate = null,
            PeriodStart = new DateOnly(2026, 8, 1),
            PeriodEnd = new DateOnly(2026, 8, 31),
        };
        _db.Milestones.Add(invoice);
        await _db.SaveChangesAsync();

        return (project, invoice);
    }

    [Fact]
    public async Task NoVatNorwegianInvoicePrintsNorwegianNoteNotEnglishOne()
    {
        var (project, invoice) = await AddNoVatNorwegianInvoiceAsync("Norsk mva-merknad");

        var markdown = await _docs.BuildMarkdownAsync(project.Id, invoice.Id);
        Assert.NotNull(markdown);

        Assert.Contains("Norsk mva-merknad", markdown);
        Assert.DoesNotContain("English foreign note", markdown);
        Assert.DoesNotContain("MVA", markdown);
    }

    [Fact]
    public async Task NoVatNorwegianInvoiceWithBlankNorwegianNotePrintsNeitherNote()
    {
        var (project, invoice) = await AddNoVatNorwegianInvoiceAsync(vatNoteNorwegian: null);

        var markdown = await _docs.BuildMarkdownAsync(project.Id, invoice.Id);
        Assert.NotNull(markdown);

        Assert.DoesNotContain("Norsk mva-merknad", markdown);
        Assert.DoesNotContain("English foreign note", markdown);
    }
}
