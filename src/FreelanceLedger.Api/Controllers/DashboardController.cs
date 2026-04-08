using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController(LedgerDbContext db) : ControllerBase
{
    /// <summary>
    /// Returns monthly revenue, costs, and P&L for a given year.
    /// All monetary values are converted to NOK using exchange rates for that month.
    /// If no exchange rate exists for a currency/month, the milestone is excluded from NOK totals.
    /// </summary>
    [HttpGet("year-overview")]
    public async Task<IActionResult> YearOverview([FromQuery] int? year)
    {
        int targetYear = year ?? DateTime.UtcNow.Year;

        var milestones = await db.Milestones
            .Include(m => m.Project)
            .Where(m => m.Status == MilestoneStatus.Paid &&
                        m.DatePaid.HasValue &&
                        m.DatePaid.Value.Year == targetYear)
            .ToListAsync();

        var tips = await db.Tips
            .Include(t => t.Project)
            .Where(t => t.Date.Year == targetYear)
            .ToListAsync();

        var costs = await db.Costs
            .Where(c => c.Year == targetYear)
            .ToListAsync();

        var rates = await db.ExchangeRates
            .Where(r => r.Year == targetYear)
            .ToListAsync();

        decimal GetNokRate(Currency currency, int month)
        {
            if (currency == Currency.NOK) return 1m;
            return rates.FirstOrDefault(r => r.Currency == currency && r.Month == month)?.Rate ?? 0m;
        }

        var months = new List<object>();
        decimal yearRevenue = 0, yearCosts = 0;

        for (int m = 1; m <= 12; m++)
        {
            // Revenue from paid milestones this month (converted to NOK, net of fee)
            decimal monthRevenue = 0;
            foreach (var milestone in milestones.Where(ms => ms.DatePaid!.Value.Month == m))
            {
                var nokRate = GetNokRate(milestone.Currency, m);
                var amountNok = milestone.Amount * nokRate;
                var feeNok = amountNok * (milestone.Project.FeePercentage / 100m);
                monthRevenue += amountNok - feeNok;
            }

            // Revenue from tips this month
            foreach (var tip in tips.Where(t => t.Date.Month == m))
            {
                var nokRate = GetNokRate(tip.Currency, m);
                monthRevenue += tip.Amount * nokRate;
            }

            // Costs this month (already in NOK)
            decimal monthCosts = costs.Where(c => c.Month == m).Sum(c => c.Amount);

            yearRevenue += monthRevenue;
            yearCosts += monthCosts;

            months.Add(new
            {
                Month = m,
                Year = targetYear,
                Revenue = monthRevenue,
                Costs = monthCosts,
                Profit = monthRevenue - monthCosts
            });
        }

        return Ok(new
        {
            Year = targetYear,
            TotalRevenue = yearRevenue,
            TotalCosts = yearCosts,
            TotalProfit = yearRevenue - yearCosts,
            Months = months
        });
    }

    /// <summary>
    /// Returns pipeline value: all projects with status Quoted or Awarded,
    /// with their pending milestone totals.
    /// </summary>
    [HttpGet("pipeline")]
    public async Task<IActionResult> Pipeline()
    {
        var projects = await db.Projects
            .Include(p => p.Milestones)
            .Where(p => p.Status == ProjectStatus.Quoted || p.Status == ProjectStatus.Awarded)
            .ToListAsync();

        var pipeline = projects.Select(p =>
        {
            var pendingTotal = p.Milestones
                .Where(m => m.Status != MilestoneStatus.Paid)
                .Sum(m => m.Amount);

            return new
            {
                p.Id,
                p.ClientName,
                p.ProjectName,
                p.Platform,
                p.Currency,
                p.Status,
                PendingMilestoneTotal = pendingTotal,
                MilestoneCount = p.Milestones.Count
            };
        });

        return Ok(pipeline);
    }
}
