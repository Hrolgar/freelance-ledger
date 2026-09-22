using FreelanceLedger.Api.Controllers;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace FreelanceLedger.Tests;

/// The guards added in the 2026-09-22 review: history cannot be deleted in one click,
/// money rows carry the project's currency, invoices stay frozen, and paid money always
/// has a paid date.
public class GuardTests : IDisposable
{
    private readonly RetainerFixture _fixture = new();
    private LedgerDbContext Db => _fixture.Db;

    public void Dispose() => _fixture.Dispose();

    private static int StatusOf(IActionResult result) => result switch
    {
        ObjectResult o => o.StatusCode ?? 200,
        StatusCodeResult s => s.StatusCode,
        _ => 200,
    };

    private async Task<Project> AddProjectAsync(Currency currency = Currency.USD, int? clientId = null)
    {
        var project = new Project
        {
            ClientId = clientId,
            ClientName = "Client",
            ProjectName = "Project",
            Currency = currency,
            BillingType = BillingType.Fixed,
            Status = ProjectStatus.InProgress,
        };
        Db.Projects.Add(project);
        await Db.SaveChangesAsync();
        return project;
    }

    [Fact]
    public async Task A_project_with_paid_money_cannot_be_deleted()
    {
        var project = await AddProjectAsync();
        Db.Milestones.Add(new Milestone { ProjectId = project.Id, Name = "M1", Amount = 100, Currency = Currency.USD, Status = MilestoneStatus.Paid, DatePaid = new DateOnly(2026, 5, 1) });
        await Db.SaveChangesAsync();

        var result = await new ProjectsController(Db).Delete(project.Id, _fixture.Files);
        Assert.Equal(409, StatusOf(result));
        Assert.NotNull(await Db.Projects.FindAsync(project.Id));
    }

    [Fact]
    public async Task A_project_without_paid_money_can_still_be_deleted()
    {
        var project = await AddProjectAsync();
        Db.Milestones.Add(new Milestone { ProjectId = project.Id, Name = "M1", Amount = 100, Currency = Currency.USD, Status = MilestoneStatus.Pending });
        await Db.SaveChangesAsync();

        var result = await new ProjectsController(Db).Delete(project.Id, _fixture.Files);
        Assert.Equal(204, StatusOf(result));
    }

    [Fact]
    public async Task A_client_with_projects_cannot_be_deleted()
    {
        var client = new Client { Name = "Big Client" };
        Db.Clients.Add(client);
        await Db.SaveChangesAsync();
        await AddProjectAsync(clientId: client.Id);

        var result = await new ClientsController(Db).Delete(client.Id);
        Assert.Equal(409, StatusOf(result));
        Assert.NotNull(await Db.Clients.FindAsync(client.Id));
    }

    [Fact]
    public async Task Milestones_tips_and_rates_must_be_in_the_projects_currency()
    {
        var project = await AddProjectAsync(Currency.USD);

        var milestone = await new MilestonesController(Db, _fixture.Files).Create(project.Id, new Milestone { Name = "M1", Amount = 10, Currency = Currency.EUR });
        Assert.Equal(400, StatusOf(milestone));

        var tip = await new TipsController(Db).Create(project.Id, new Tip { Amount = 5, Currency = Currency.NOK, Date = new DateOnly(2026, 1, 1) });
        Assert.Equal(400, StatusOf(tip));

        var rate = await new ProjectRatesController(Db).Create(project.Id, new ProjectRate { Rate = 60, Currency = Currency.GBP, EffectiveFrom = new DateOnly(2026, 1, 1) });
        Assert.Equal(400, StatusOf(rate));
    }

    [Fact]
    public async Task Project_currency_is_locked_once_it_has_money()
    {
        var project = await AddProjectAsync(Currency.USD);
        Db.Milestones.Add(new Milestone { ProjectId = project.Id, Name = "M1", Amount = 10, Currency = Currency.USD });
        await Db.SaveChangesAsync();

        var updated = new Project { ClientName = "Client", ProjectName = "Project", Currency = Currency.EUR, BillingType = BillingType.Fixed };
        var result = await new ProjectsController(Db).Update(project.Id, updated);
        Assert.Equal(409, StatusOf(result));
    }

    [Fact]
    public async Task A_hand_made_milestone_never_carries_invoice_fields()
    {
        var project = await AddProjectAsync();
        var result = await new MilestonesController(Db, _fixture.Files).Create(project.Id, new Milestone
        {
            Name = "Looks like an invoice", Amount = 10, Currency = Currency.USD,
            InvoiceNumber = "FAKE-1", VatRate = 25, VatAmount = 2.5m, InvoiceDate = new DateOnly(2026, 1, 1), Hours = 3,
        });
        Assert.Equal(201, StatusOf(result));
        var saved = (Milestone)((CreatedAtActionResult)result).Value!;
        Assert.Null(saved.InvoiceNumber);
        Assert.Null(saved.VatRate);
        Assert.Null(saved.VatAmount);
        Assert.Null(saved.InvoiceDate);
        Assert.Null(saved.Hours);
    }

    [Fact]
    public async Task An_invoice_milestone_keeps_its_amount_and_a_paid_one_is_frozen()
    {
        var project = await AddProjectAsync();
        var invoice = new Milestone
        {
            ProjectId = project.Id, Name = "INV-1", Amount = 100, Currency = Currency.USD,
            Status = MilestoneStatus.Pending, InvoiceNumber = "INV-1", VatRate = 25, VatAmount = 25,
        };
        Db.Milestones.Add(invoice);
        await Db.SaveChangesAsync();

        var ctl = new MilestonesController(Db, _fixture.Files);
        var changedAmount = await ctl.Update(project.Id, invoice.Id, new Milestone { Name = "INV-1", Amount = 90, Currency = Currency.USD, Status = MilestoneStatus.Pending });
        Assert.Equal(409, StatusOf(changedAmount));

        var renamed = await ctl.Update(project.Id, invoice.Id, new Milestone { Name = "INV-1 (resent)", Amount = 100, Currency = Currency.USD, Status = MilestoneStatus.Paid });
        Assert.Equal(200, StatusOf(renamed));
        var saved = (Milestone)((OkObjectResult)renamed).Value!;
        Assert.Equal("INV-1 (resent)", saved.Name);
        Assert.NotNull(saved.DatePaid); // paid without a date gets today
        Assert.Equal(25m, saved.VatAmount);
    }

    [Fact]
    public async Task Patching_to_paid_stamps_a_date_and_unpaying_clears_it()
    {
        var project = await AddProjectAsync();
        var milestone = new Milestone { ProjectId = project.Id, Name = "M1", Amount = 100, Currency = Currency.USD, Status = MilestoneStatus.Pending };
        Db.Milestones.Add(milestone);
        await Db.SaveChangesAsync();

        var ctl = new MilestonesController(Db, _fixture.Files);
        var paid = await ctl.Patch(milestone.Id, new MilestonePatchRequest(MilestoneStatus.Paid, null, null));
        Assert.Equal(200, StatusOf(paid));
        Assert.Equal(Clock.Today, ((Milestone)((OkObjectResult)paid).Value!).DatePaid);

        var unpaid = await ctl.Patch(milestone.Id, new MilestonePatchRequest(MilestoneStatus.Pending, null, null));
        Assert.Null(((Milestone)((OkObjectResult)unpaid).Value!).DatePaid);
    }

    [Fact]
    public void Csv_neutralises_formula_characters()
    {
        var method = typeof(ExportController).GetMethod("EscapeCsv", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        string Escape(string v) => (string)method.Invoke(null, [v])!;
        Assert.StartsWith("\"'=", Escape("=HYPERLINK(\"x\")"));
        Assert.Equal("'+1", Escape("+1"));
        Assert.Equal("Plain name", Escape("Plain name"));
    }
}
