using System.Globalization;
using System.Text;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/export")]
public class ExportController(LedgerDbContext db, ExchangeRateService rateService) : ControllerBase
{
    [HttpGet("year/{year:int}/paid-milestones.csv")]
    public async Task<IActionResult> ExportPaidMilestonesCsv(int year)
    {
        var projects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .Include(p => p.Client)
            .ToListAsync();

        await rateService.PreloadYear(year);

        var sb = new StringBuilder();
        sb.AppendLine("Date,Type,Project,Client,Platform,Currency,Gross,Fee Pct,Fee Amount,Net,Net NOK");

        var rows = new List<(DateOnly date, string type, string projectName, string clientName, Platform platform, Currency currency, decimal gross, decimal feePct, decimal feeAmount, decimal net, decimal netNok)>();

        foreach (var project in projects)
        {
            // Paid milestones
            foreach (var m in project.Milestones.Where(m => m.Status == MilestoneStatus.Paid && m.DatePaid.HasValue && m.DatePaid.Value.Year == year))
            {
                var feeAmount = m.Amount * (project.FeePercentage / 100m);
                var net = m.Amount - feeAmount;
                var rate = await rateService.GetRate(project.Currency, m.DatePaid!.Value.Month, m.DatePaid.Value.Year);
                var clientName = project.Client?.Name ?? project.ClientName;
                rows.Add((m.DatePaid.Value, "Milestone", $"{project.ProjectName} - {m.Name}", clientName, project.Platform, project.Currency, m.Amount, project.FeePercentage, feeAmount, net, net * rate));
            }

            // Tips
            foreach (var t in project.Tips.Where(t => t.Date.Year == year))
            {
                var feeAmount = t.Amount * (project.FeePercentage / 100m);
                var net = t.Amount - feeAmount;
                var rate = await rateService.GetRate(t.Currency, t.Date.Month, t.Date.Year);
                var clientName = project.Client?.Name ?? project.ClientName;
                rows.Add((t.Date, "Tip", project.ProjectName, clientName, project.Platform, t.Currency, t.Amount, project.FeePercentage, feeAmount, net, net * rate));
            }
        }

        foreach (var row in rows.OrderBy(r => r.date))
        {
            sb.Append(row.date.ToString("yyyy-MM-dd")).Append(',');
            sb.Append(EscapeCsv(row.type)).Append(',');
            sb.Append(EscapeCsv(row.projectName)).Append(',');
            sb.Append(EscapeCsv(row.clientName)).Append(',');
            sb.Append(row.platform).Append(',');
            sb.Append(row.currency).Append(',');
            sb.Append(row.gross.ToString("F2", CultureInfo.InvariantCulture)).Append(',');
            sb.Append(row.feePct.ToString("F1", CultureInfo.InvariantCulture)).Append(',');
            sb.Append(row.feeAmount.ToString("F2", CultureInfo.InvariantCulture)).Append(',');
            sb.Append(row.net.ToString("F2", CultureInfo.InvariantCulture)).Append(',');
            sb.Append(Math.Round(row.netNok, 2).ToString("F2", CultureInfo.InvariantCulture));
            sb.AppendLine();
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"freelance-ledger-{year}.csv");
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
        {
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
