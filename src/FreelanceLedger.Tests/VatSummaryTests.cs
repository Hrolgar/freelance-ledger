using System.Linq;
using System.Net.Http;
using FreelanceLedger.Api.Controllers;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FreelanceLedger.Tests;

public sealed class VatSummaryTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly LedgerDbContext _db;

    public VatSummaryTests()
    {
        _connection.Open();
        var options = new DbContextOptionsBuilder<LedgerDbContext>().UseSqlite(_connection).Options;
        _db = new LedgerDbContext(options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private static DashboardController Controller(LedgerDbContext db) =>
        new(db, new ExchangeRateService(db, new HttpClient(), Microsoft.Extensions.Logging.Abstractions.NullLogger<ExchangeRateService>.Instance));

    [Fact]
    public async Task VatSummaryGroupsIntoTerminsByInvoiceDateAndIgnoresInvoicesWithoutVat()
    {
        var project = new Project
        {
            ClientName = "NO Client",
            ProjectName = "NO Project",
            Currency = Currency.NOK,
            Status = ProjectStatus.InProgress,
            VatRate = 25m,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        _db.Milestones.AddRange(
            new Milestone
            {
                ProjectId = project.Id,
                Name = "Jan invoice",
                Amount = 10000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Paid,
                InvoiceNumber = "OC-2026-001",
                InvoiceDate = new DateOnly(2026, 1, 15),
                VatRate = 25m,
                VatAmount = 2500m,
            },
            new Milestone
            {
                ProjectId = project.Id,
                Name = "Feb invoice",
                Amount = 4000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Pending,
                InvoiceNumber = "OC-2026-002",
                InvoiceDate = new DateOnly(2026, 2, 20),
                VatRate = 25m,
                VatAmount = 1000m,
            },
            new Milestone
            {
                ProjectId = project.Id,
                Name = "Sep invoice",
                Amount = 12000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Pending,
                InvoiceNumber = "OC-2026-003",
                InvoiceDate = new DateOnly(2026, 9, 5),
                VatRate = 25m,
                VatAmount = 3000m,
            },
            // Not a VAT invoice -- must never show up anywhere in the summary.
            new Milestone
            {
                ProjectId = project.Id,
                Name = "No VAT invoice",
                Amount = 5000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Pending,
                InvoiceNumber = "OC-2026-004",
                InvoiceDate = new DateOnly(2026, 3, 1),
                VatRate = null,
            });
        await _db.SaveChangesAsync();

        var response = await Controller(_db).GetVatSummary(2026);

        var ok = Assert.IsType<OkObjectResult>(response);
        var summary = Assert.IsType<VatSummaryResponse>(ok.Value);

        Assert.Equal(6500m, summary.TotalVatNok);
        Assert.Equal(2500m, summary.PaidVatNok);
        Assert.DoesNotContain(summary.Invoices, i => i.InvoiceNumber == "OC-2026-004");

        var term1 = summary.Terms.Single(t => t.Term == 1);
        Assert.Equal(2, term1.InvoiceCount);
        Assert.Equal(14000m, term1.NetNok);
        Assert.Equal(3500m, term1.VatNok);
        Assert.Equal(2500m, term1.PaidVatNok);

        var term5 = summary.Terms.Single(t => t.Term == 5);
        Assert.Equal(1, term5.InvoiceCount);
        Assert.Equal(12000m, term5.NetNok);
        Assert.Equal(3000m, term5.VatNok);
        Assert.Equal(0m, term5.PaidVatNok);

        foreach (var term in summary.Terms.Where(t => t.Term != 1 && t.Term != 5))
        {
            Assert.Equal(0, term.InvoiceCount);
            Assert.Equal(0m, term.NetNok);
            Assert.Equal(0m, term.VatNok);
            Assert.Equal(0m, term.PaidVatNok);
        }
    }

    [Fact]
    public async Task VatSummaryFiltersByInvoiceDateYearNotPaidDate()
    {
        var project = new Project
        {
            ClientName = "NO Client",
            ProjectName = "NO Project",
            Currency = Currency.NOK,
            Status = ProjectStatus.InProgress,
            VatRate = 25m,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        _db.Milestones.AddRange(
            // Raised the previous year but paid in 2026 -- must stay out of the 2026
            // summary because the termin is decided by invoice date, not paid date.
            new Milestone
            {
                ProjectId = project.Id,
                Name = "Prior year invoice",
                Amount = 8000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Paid,
                InvoiceNumber = "OC-2025-099",
                InvoiceDate = new DateOnly(2025, 12, 31),
                DatePaid = new DateOnly(2026, 1, 5),
                VatRate = 25m,
                VatAmount = 2000m,
            },
            new Milestone
            {
                ProjectId = project.Id,
                Name = "New year invoice",
                Amount = 6000m,
                Currency = Currency.NOK,
                Status = MilestoneStatus.Pending,
                InvoiceNumber = "OC-2026-001",
                InvoiceDate = new DateOnly(2026, 1, 1),
                VatRate = 25m,
                VatAmount = 1500m,
            });
        await _db.SaveChangesAsync();

        var response = await Controller(_db).GetVatSummary(2026);

        var ok = Assert.IsType<OkObjectResult>(response);
        var summary = Assert.IsType<VatSummaryResponse>(ok.Value);

        Assert.DoesNotContain(summary.Invoices, i => i.InvoiceNumber == "OC-2025-099");
        Assert.Contains(summary.Invoices, i => i.InvoiceNumber == "OC-2026-001");
        Assert.Equal(1500m, summary.TotalVatNok);
    }
}
