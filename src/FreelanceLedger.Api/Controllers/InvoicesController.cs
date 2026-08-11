using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

/// An invoice IS a Milestone. Storing it that way means revenue, monthly P&L, pipeline,
/// fee maths and the CSV export all keep working with no changes -- an hourly project
/// earns money through the same path a fixed-price one does.
[ApiController]
[Route("api/projects/{projectId:int}/invoices")]
public class InvoicesController(LedgerDbContext db, InvoiceDocumentService docs) : ControllerBase
{
    /// The invoice as markdown -- the editable source, and the fallback when the PDF
    /// renderer is not available.
    [HttpGet("{id:int}/markdown")]
    public async Task<IActionResult> GetMarkdown(int projectId, int id)
    {
        var markdown = await docs.BuildMarkdownAsync(projectId, id);
        if (markdown is null)
            return Problem(title: "Not Found", detail: $"Invoice {id} not found.", statusCode: 404);

        return Content(markdown, "text/markdown; charset=utf-8");
    }

    /// The invoice as a PDF, in the same house style as the invoices already sent.
    /// Available at any time, for any invoice, however old.
    [HttpGet("{id:int}/pdf")]
    public async Task<IActionResult> GetPdf(int projectId, int id)
    {
        var invoice = await db.Milestones
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId && m.InvoiceNumber != null);
        if (invoice is null)
            return Problem(title: "Not Found", detail: $"Invoice {id} not found.", statusCode: 404);

        var markdown = await docs.BuildMarkdownAsync(projectId, id);
        if (markdown is null)
            return Problem(title: "Not Found", detail: $"Invoice {id} not found.", statusCode: 404);

        var project = await db.Projects.AsNoTracking()
            .Include(p => p.Client)
            .FirstAsync(p => p.Id == projectId);
        var clientName = project.Client?.Name ?? project.ClientName;

        var pdf = await docs.RenderPdfAsync(markdown, invoice.InvoiceNumber!, clientName);
        if (pdf is null)
            return Problem(
                title: "Renderer Unavailable",
                detail: "The PDF renderer could not run. The markdown version is available at the /markdown endpoint.",
                statusCode: 503);

        return File(pdf, "application/pdf", $"Invoice-{invoice.InvoiceNumber}.pdf");
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var invoices = await db.Milestones
            .AsNoTracking()
            .Where(m => m.ProjectId == projectId && m.InvoiceNumber != null)
            .OrderByDescending(m => m.PeriodStart)
            .ToListAsync();

        return Ok(invoices);
    }

    /// Sweep every unbilled period overlapping [from, to] into one invoice.
    /// Any range, any time -- this is not tied to month end.
    [HttpPost]
    public async Task<IActionResult> Create(int projectId, [FromBody] CreateInvoiceRequest request)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        if (request.To < request.From)
            return Problem(title: "Invalid Range", detail: "'to' is before 'from'.", statusCode: 400);

        var entries = await db.TimeEntries
            .Where(t => t.ProjectId == projectId
                        && t.InvoiceMilestoneId == null
                        && t.PeriodStart <= request.To
                        && t.PeriodEnd >= request.From)
            .OrderBy(t => t.PeriodStart)
            .ToListAsync();

        if (entries.Count == 0)
            return Problem(
                title: "Nothing To Invoice",
                detail: $"No unbilled hours between {request.From:yyyy-MM-dd} and {request.To:yyyy-MM-dd}. Log the hours first, or widen the range.",
                statusCode: 400);

        var currencies = entries.Select(e => e.Currency).Distinct().ToList();
        if (currencies.Count > 1)
            return Problem(
                title: "Mixed Currencies",
                detail: $"The periods in this range are billed in {string.Join(" and ", currencies)}. Invoice them separately.",
                statusCode: 400);

        var totalHours = entries.Sum(e => e.Hours);
        var amount = entries.Sum(e => e.Hours * e.RateApplied);
        var distinctRates = entries.Select(e => e.RateApplied).Distinct().ToList();

        var invoiceNumber = string.IsNullOrWhiteSpace(request.InvoiceNumber)
            ? await NextInvoiceNumberAsync(project, request.From)
            : request.InvoiceNumber.Trim();

        var clash = await db.Milestones.AnyAsync(m => m.InvoiceNumber == invoiceNumber);
        if (clash)
            return Problem(
                title: "Duplicate Invoice Number",
                detail: $"Invoice {invoiceNumber} already exists.",
                statusCode: 409);

        var sortOrder = await db.Milestones
            .Where(m => m.ProjectId == projectId)
            .MaxAsync(m => (int?)m.SortOrder) ?? 0;

        var invoice = new Milestone
        {
            ProjectId = projectId,
            Name = request.Name?.Trim() is { Length: > 0 } n
                ? n
                : $"{invoiceNumber} ({request.From:d MMM} to {request.To:d MMM yyyy})",
            Description = request.Description,
            Amount = amount,
            Currency = currencies[0],
            Status = MilestoneStatus.Pending,
            DateDue = request.DateDue,
            SortOrder = sortOrder + 1,
            Hours = totalHours,
            // Only meaningful when every period billed at the same rate. Across a rate
            // change it stays null and the per-period lines carry the detail.
            RateApplied = distinctRates.Count == 1 ? distinctRates[0] : null,
            PeriodStart = entries.Min(e => e.PeriodStart),
            PeriodEnd = entries.Max(e => e.PeriodEnd),
            InvoiceNumber = invoiceNumber,
        };

        // Two writes are needed because the entries need the milestone's generated id.
        // Wrapped in a transaction so a failure between them cannot leave an invoice
        // standing with its hours still marked unbilled, which would invite billing
        // the same work twice.
        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            db.Milestones.Add(invoice);
            await db.SaveChangesAsync();

            foreach (var entry in entries)
                entry.InvoiceMilestoneId = invoice.Id;
            await db.SaveChangesAsync();

            await tx.CommitAsync();
        }

        return CreatedAtAction(nameof(GetById), new { projectId, id = invoice.Id },
            new { invoice, periods = entries.Count, totalHours });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int projectId, int id)
    {
        var invoice = await db.Milestones
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId && m.InvoiceNumber != null);

        if (invoice is null)
            return Problem(title: "Not Found", detail: $"Invoice {id} not found.", statusCode: 404);

        var entries = await db.TimeEntries
            .AsNoTracking()
            .Where(t => t.InvoiceMilestoneId == id)
            .OrderBy(t => t.PeriodStart)
            .ToListAsync();

        return Ok(new { invoice, entries });
    }

    /// Unpicks an invoice raised in error. The milestone goes; the logged periods stay
    /// and go back to unbilled so they can be invoiced again.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var invoice = await db.Milestones
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId && m.InvoiceNumber != null);

        if (invoice is null)
            return Problem(title: "Not Found", detail: $"Invoice {id} not found.", statusCode: 404);

        if (invoice.Status == MilestoneStatus.Paid)
            return Problem(
                title: "Invoice Paid",
                detail: "This invoice is marked paid. Change its status first if you really mean to remove it.",
                statusCode: 409);

        var entries = await db.TimeEntries.Where(t => t.InvoiceMilestoneId == id).ToListAsync();
        foreach (var entry in entries)
            entry.InvoiceMilestoneId = null;

        db.Milestones.Remove(invoice);
        await db.SaveChangesAsync();

        return Ok(new { released = entries.Count });
    }

    /// Next sequential number for the project's prefix within the invoice's year,
    /// e.g. OC-2026-001. Falls back to the project id when no prefix is set.
    private async Task<string> NextInvoiceNumberAsync(Project project, DateOnly periodStart)
    {
        var prefix = string.IsNullOrWhiteSpace(project.InvoicePrefix)
            ? $"P{project.Id}"
            : project.InvoicePrefix.Trim().ToUpperInvariant();
        var year = periodStart.Year;
        var stem = $"{prefix}-{year}-";

        var used = await db.Milestones
            .Where(m => m.InvoiceNumber != null && m.InvoiceNumber.StartsWith(stem))
            .Select(m => m.InvoiceNumber!)
            .ToListAsync();

        var highest = used
            .Select(n => int.TryParse(n[stem.Length..], out var seq) ? seq : 0)
            .DefaultIfEmpty(0)
            .Max();

        return $"{stem}{highest + 1:D3}";
    }
}

public record CreateInvoiceRequest(
    DateOnly From,
    DateOnly To,
    string? InvoiceNumber,
    string? Name,
    string? Description,
    DateOnly? DateDue);
