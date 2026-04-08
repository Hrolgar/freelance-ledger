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

        // Preload all rates for the year in one DB query
        await rateService.PreloadYear(year);

        var monthResults = new List<MonthlyOverviewResponse>();
        foreach (var month in Enumerable.Range(1, 12))
        {
            decimal revenue = 0;
            foreach (var project in projects)
            {
                var paidMilestones = project.Milestones
                    .Where(m => m.Status == MilestoneStatus.Paid &&
                                m.DatePaid.HasValue &&
                                m.DatePaid.Value.Year == year &&
                                m.DatePaid.Value.Month == month)
                    .Sum(m => m.Amount);

                var tips = project.Tips
                    .Where(t => t.Date.Year == year && t.Date.Month == month)
                    .Sum(t => t.Amount);

                var gross = paidMilestones + tips;
                var net = gross - (gross * (project.FeePercentage / 100m));

                // Convert to NOK
                var rate = await rateService.GetRate(project.Currency, month, year);
                revenue += net * rate;
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
                var costRate = await rateService.GetRate(c.Currency, month, year);
                monthCosts += c.Amount * costRate;
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
            monthResults));
    }

    [HttpGet("pipeline")]
    public async Task<IActionResult> GetPipeline()
    {
        var pipelineProjects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .Where(p => p.Status == ProjectStatus.Quoted || p.Status == ProjectStatus.Awarded)
            .ToListAsync();

        var projects = pipelineProjects
            .Select(project =>
            {
                var gross = project.Milestones.Sum(m => m.Amount) + project.Tips.Sum(t => t.Amount);
                var net = gross - (gross * (project.FeePercentage / 100m));

                return new PipelineProjectResponse(
                    project.Id,
                    project.ClientName,
                    project.ProjectName,
                    project.Status,
                    project.Currency,
                    gross,
                    net);
            })
            .OrderByDescending(project => project.NetValue)
            .ToList();

        return Ok(new PipelineResponse(projects.Sum(project => project.NetValue), projects));
    }
}

public record MonthlyOverviewResponse(int Month, decimal Revenue, decimal Costs, decimal Profit);

public record YearOverviewResponse(
    int Year,
    decimal TotalRevenue,
    decimal TotalCosts,
    decimal TotalProfit,
    IReadOnlyList<MonthlyOverviewResponse> Months);

public record PipelineProjectResponse(
    int ProjectId,
    string ClientName,
    string ProjectName,
    ProjectStatus Status,
    Currency Currency,
    decimal GrossValue,
    decimal NetValue);

public record PipelineResponse(decimal TotalPipelineValue, IReadOnlyList<PipelineProjectResponse> Projects);
