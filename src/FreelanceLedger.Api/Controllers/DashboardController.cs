using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController(LedgerDbContext db, ExchangeRateService rateService) : ControllerBase
{
    [HttpGet("year-overview")]
    public async Task<IActionResult> GetYearOverview([FromQuery] int year)
    {
        var projects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .ToListAsync();

        var allCosts = await db.Costs.AsNoTracking().ToListAsync();

        // Fetch any past month that has no rate yet, then preload the year in one query.
        // A missing rate used to turn a month's revenue into 0 NOK with no warning.
        await rateService.EnsureYearAsync(year);
        await rateService.PreloadYear(year);
        var missing = new SortedSet<string>();

        var today = Clock.Today;
        async Task<decimal> ToNok(Currency currency, decimal amount, int month)
        {
            if (amount == 0m) return 0m;
            var rate = await rateService.GetRate(currency, month, year);
            if (rate == 0m && currency != Currency.NOK)
            {
                // A month that has not happened yet has no rate by definition (a
                // recurring cost projects into it); only a past or current month with
                // money and no rate is worth a warning.
                var inFuture = year > today.Year || (year == today.Year && month > today.Month);
                if (!inFuture)
                    missing.Add($"{currency} {year}-{month:00}");
                return 0m;
            }
            return amount * rate;
        }

        var monthResults = new List<MonthlyOverviewResponse>();
        foreach (var month in Enumerable.Range(1, 12))
        {
            decimal revenue = 0;
            foreach (var project in projects)
            {
                var fee = project.FeePercentage / 100m;
                // Each row converts in ITS OWN currency. Converting by the project's
                // currency was wrong the moment a milestone was stored in another one
                // (two EUR milestones sit on a USD project on prod).
                foreach (var m in project.Milestones.Where(m =>
                             m.Status == MilestoneStatus.Paid && m.DatePaid.HasValue
                             && m.DatePaid.Value.Year == year && m.DatePaid.Value.Month == month))
                    revenue += await ToNok(m.Currency, m.Amount - m.Amount * fee, month);

                foreach (var t in project.Tips.Where(t => t.Date.Year == year && t.Date.Month == month))
                    revenue += await ToNok(t.Currency, t.Amount - t.Amount * fee, month);
            }

            decimal monthCosts = 0;
            foreach (var c in allCosts)
            {
                var startKey = c.Year * 12 + c.Month;
                var queryKey = year * 12 + month;
                bool applies;
                if (!c.Recurring)
                    applies = c.Month == month && c.Year == year;
                else
                {
                    if (startKey > queryKey) applies = false;
                    else if (!c.EndMonth.HasValue || !c.EndYear.HasValue) applies = true;
                    else applies = queryKey <= c.EndYear.Value * 12 + c.EndMonth.Value;
                }
                if (!applies) continue;
                monthCosts += await ToNok(c.Currency, c.Amount, month);
            }
            monthCosts = Math.Round(monthCosts, 2);

            monthResults.Add(new MonthlyOverviewResponse(
                month,
                Math.Round(revenue, 2),
                monthCosts,
                Math.Round(revenue - monthCosts, 2)));
        }

        var totalRevenue = monthResults.Sum(m => m.Revenue);
        var totalCosts = monthResults.Sum(m => m.Costs);

        return Ok(new YearOverviewResponse(
            year,
            totalRevenue,
            totalCosts,
            totalRevenue - totalCosts,
            monthResults,
            missing.ToList()));
    }

    [HttpGet("pipeline")]
    public async Task<IActionResult> GetPipeline()
    {
        var allProjects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .Where(p => p.Status != ProjectStatus.Paid && p.Status != ProjectStatus.OnHold)
            .ToListAsync();

        var onHoldProjects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .Where(p => p.Status == ProjectStatus.OnHold)
            .ToListAsync();

        var onHoldCount = onHoldProjects.Count(p =>
            p.Milestones.Where(m => m.Status != MilestoneStatus.Paid).Sum(m => m.Amount) > 0);

        var projects = allProjects
            .Select(project =>
            {
                var unpaidGross = project.Milestones
                    .Where(m => m.Status != MilestoneStatus.Paid)
                    .Sum(m => m.Amount);
                var unpaidNet = unpaidGross - (unpaidGross * (project.FeePercentage / 100m));

                var gross = project.Milestones.Sum(m => m.Amount) + project.Tips.Sum(t => t.Amount);
                var net = gross - (gross * (project.FeePercentage / 100m));

                return new PipelineProjectResponse(
                    project.Id,
                    project.ClientName,
                    project.ProjectName,
                    project.Status,
                    project.BillingType,
                    project.Currency,
                    gross,
                    net,
                    unpaidGross,
                    unpaidNet);
            })
            .Where(p => p.UnpaidGross > 0)
            .OrderByDescending(project => project.UnpaidNet)
            .ToList();

        var today = Clock.Today;
        await rateService.EnsureRatesExist(today.Month, today.Year);
        await rateService.PreloadYear(today.Year);

        decimal totalUnpaidNetNok = 0;
        decimal totalUnpaidGrossNok = 0;
        var missing = new SortedSet<string>();
        foreach (var project in projects)
        {
            var rate = await rateService.GetRate(project.Currency, today.Month, today.Year);
            if (rate == 0m && project.Currency != Currency.NOK)
                missing.Add($"{project.Currency} {today.Year}-{today.Month:00}");
            totalUnpaidNetNok += project.UnpaidNet * rate;
            totalUnpaidGrossNok += project.UnpaidGross * rate;
        }

        var byStatus = projects
            .GroupBy(p => p.Status)
            .ToDictionary(g => g.Key, g => g.Count());

        return Ok(new PipelineResponse(
            Math.Round(totalUnpaidNetNok, 2),
            Math.Round(totalUnpaidGrossNok, 2),
            projects,
            byStatus,
            onHoldCount,
            missing.ToList()));
    }

    // Norwegian output VAT (utgaende merverdiavgift) is reported to Skatteetaten per
    // termin, six two-month periods a year, counted by invoice date.
    private static readonly (int FromMonth, int ToMonth, int DeadlineMonth, int DeadlineDay, int DeadlineYearOffset)[] VatTerms =
    [
        (1, 2, 4, 10, 0),
        (3, 4, 6, 10, 0),
        (5, 6, 8, 31, 0),
        (7, 8, 10, 10, 0),
        (9, 10, 12, 10, 0),
        (11, 12, 2, 10, 1),
    ];

    [HttpGet("vat")]
    public async Task<IActionResult> GetVatSummary([FromQuery] int? year)
    {
        var resolvedYear = year ?? Clock.Today.Year;

        var projects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .ToListAsync();

        await rateService.EnsureYearAsync(resolvedYear);
        await rateService.PreloadYear(resolvedYear);

        var invoices = new List<VatInvoiceResponse>();
        var netNokByInvoice = new Dictionary<int, decimal>();
        foreach (var project in projects)
        {
            foreach (var milestone in project.Milestones)
            {
                if (milestone.VatRate is null || milestone.InvoiceNumber is null) continue;

                var invoiceDate = milestone.InvoiceDate ?? milestone.DateDue ?? milestone.DatePaid;
                if (invoiceDate is null || invoiceDate.Value.Year != resolvedYear) continue;

                var term = TermForMonth(invoiceDate.Value.Month);
                var rate = await rateService.GetRate(milestone.Currency, invoiceDate.Value.Month, invoiceDate.Value.Year);
                var vatNok = Math.Round((milestone.VatAmount ?? 0m) * rate, 2);
                netNokByInvoice[milestone.Id] = Math.Round(milestone.Amount * rate, 2);

                invoices.Add(new VatInvoiceResponse(
                    project.Id,
                    project.ProjectName,
                    project.ClientName,
                    milestone.Id,
                    milestone.InvoiceNumber,
                    invoiceDate.Value,
                    term,
                    milestone.Currency,
                    milestone.Amount,
                    milestone.VatRate.Value,
                    milestone.VatAmount ?? 0m,
                    vatNok,
                    milestone.Status,
                    milestone.DatePaid));
            }
        }

        invoices = invoices.OrderBy(i => i.InvoiceDate).ToList();

        var terms = new List<VatTermResponse>();
        for (var i = 0; i < VatTerms.Length; i++)
        {
            var (fromMonth, toMonth, deadlineMonth, deadlineDay, deadlineYearOffset) = VatTerms[i];
            var termNumber = i + 1;
            var termInvoices = invoices.Where(inv => inv.Term == termNumber).ToList();

            terms.Add(new VatTermResponse(
                termNumber,
                fromMonth,
                toMonth,
                new DateOnly(resolvedYear + deadlineYearOffset, deadlineMonth, deadlineDay),
                Math.Round(termInvoices.Sum(inv => netNokByInvoice[inv.InvoiceId]), 2),
                Math.Round(termInvoices.Sum(inv => inv.VatNok), 2),
                Math.Round(termInvoices.Where(inv => inv.Status == MilestoneStatus.Paid).Sum(inv => inv.VatNok), 2),
                termInvoices.Count));
        }

        return Ok(new VatSummaryResponse(
            resolvedYear,
            Math.Round(invoices.Sum(inv => netNokByInvoice[inv.InvoiceId]), 2),
            Math.Round(invoices.Sum(inv => inv.VatNok), 2),
            Math.Round(invoices.Where(inv => inv.Status == MilestoneStatus.Paid).Sum(inv => inv.VatNok), 2),
            terms,
            invoices));
    }

    private static int TermForMonth(int month) => (month - 1) / 2 + 1;
}

public record MonthlyOverviewResponse(int Month, decimal Revenue, decimal Costs, decimal Profit);

public record YearOverviewResponse(
    int Year,
    decimal TotalRevenue,
    decimal TotalCosts,
    decimal TotalProfit,
    IReadOnlyList<MonthlyOverviewResponse> Months,
    /// "USD 2026-03" for every currency-month that had money to convert and no rate,
    /// so the page can say so instead of showing a quietly smaller total.
    IReadOnlyList<string> MissingRates);

public record PipelineProjectResponse(
    int ProjectId,
    string ClientName,
    string ProjectName,
    ProjectStatus Status,
    // Carried so the dashboard can word a retainer's status the way its own page does
    // ("Active" rather than "In Progress"). Presentation only.
    BillingType BillingType,
    Currency Currency,
    decimal GrossValue,
    decimal NetValue,
    decimal UnpaidGross,
    decimal UnpaidNet);

public record PipelineResponse(
    decimal TotalPipelineValue,
    decimal TotalPipelineGrossValue,
    IReadOnlyList<PipelineProjectResponse> Projects,
    IReadOnlyDictionary<ProjectStatus, int> ByStatus,
    int OnHoldCount,
    IReadOnlyList<string> MissingRates);

public record VatTermResponse(
    int Term,
    int FromMonth,
    int ToMonth,
    DateOnly ReportingDeadline,
    decimal NetNok,
    decimal VatNok,
    decimal PaidVatNok,
    int InvoiceCount);

public record VatInvoiceResponse(
    int ProjectId,
    string ProjectName,
    string ClientName,
    int InvoiceId,
    string InvoiceNumber,
    DateOnly InvoiceDate,
    int Term,
    Currency Currency,
    decimal Amount,
    decimal VatRate,
    decimal VatAmount,
    decimal VatNok,
    MilestoneStatus Status,
    DateOnly? DatePaid);

public record VatSummaryResponse(
    int Year,
    decimal TotalNetNok,
    decimal TotalVatNok,
    decimal PaidVatNok,
    IReadOnlyList<VatTermResponse> Terms,
    IReadOnlyList<VatInvoiceResponse> Invoices);
