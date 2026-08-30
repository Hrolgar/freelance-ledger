using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using System.Globalization;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

/// An invoice IS a Milestone. Storing it that way means revenue, monthly P&L, pipeline,
/// fee maths and the CSV export all keep working with no changes -- an hourly project
/// earns money through the same path a fixed-price one does.
[ApiController]
[Route("api/projects/{projectId:int}/invoices")]
public class InvoicesController(
    LedgerDbContext db,
    InvoiceDocumentService docs,
    ProjectFileStore files,
    InvoiceNumberService invoiceNumbers,
    RetainerInvoiceService retainer) : ControllerBase
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

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

        var doc = await docs.BuildAsync(projectId, id);
        if (doc is null)
            return Problem(title: "Not Found", detail: $"Invoice {id} not found.", statusCode: 404);

        var pdf = await docs.RenderPdfAsync(doc);
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

        if (project.BillingType == BillingType.Fixed)
            return Problem(
                title: "Not Applicable",
                detail: "This project bills through milestones.",
                statusCode: 400);

        if (project.BillingType == BillingType.Retainer)
        {
            var result = await retainer.RaiseAsync(
                project, request.From, request.To,
                request.InvoiceNumber, request.Name, request.Description,
                request.DateDue, request.InvoiceDate);

            return result.Status switch
            {
                RetainerInvoiceService.RaiseStatus.Ok => CreatedAtAction(
                    nameof(GetById), new { projectId, id = result.Invoice!.Id },
                    new { invoice = result.Invoice, periods = 0, totalHours = (decimal?)null, file = result.File }),
                RetainerInvoiceService.RaiseStatus.NoRateInForce =>
                    Problem(title: "No Rate Set", detail: result.Detail, statusCode: 400),
                RetainerInvoiceService.RaiseStatus.InvalidInvoiceNumber =>
                    Problem(title: "Invalid Invoice Number", detail: result.Detail, statusCode: 400),
                RetainerInvoiceService.RaiseStatus.PeriodOverlap =>
                    Problem(title: "Period Already Invoiced", detail: result.Detail, statusCode: 409),
                RetainerInvoiceService.RaiseStatus.DuplicateInvoiceNumber =>
                    Problem(title: "Duplicate Invoice Number", detail: result.Detail, statusCode: 409),
                _ => Problem(statusCode: 500),
            };
        }

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
            ? await invoiceNumbers.NextAsync(project, request.From)
            : request.InvoiceNumber.Trim();

        if (!InvoiceNumberService.IsValid(invoiceNumber))
            return Problem(
                title: "Invalid Invoice Number",
                detail: "Use up to 40 letters, digits, spaces, dots, dashes or underscores.",
                statusCode: 400);

        var clash = await db.Milestones.AnyAsync(m => m.InvoiceNumber == invoiceNumber);
        if (clash)
            return Problem(
                title: "Duplicate Invoice Number",
                detail: $"Invoice {invoiceNumber} already exists.",
                statusCode: 409);

        var sortOrder = await db.Milestones
            .Where(m => m.ProjectId == projectId)
            .MaxAsync(m => (int?)m.SortOrder) ?? 0;

        // Name the invoice after the periods it actually covers, not the search range
        // that was swept -- asking for "all of 2026" and catching one week should not
        // produce a line claiming to cover the year.
        var coveredFrom = entries.Min(e => e.PeriodStart);
        var coveredTo = entries.Max(e => e.PeriodEnd);

        var issued = request.InvoiceDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var vatRate = project.VatRate;
        var vatAmount = VatCalculator.Amount(amount, vatRate);

        var invoice = new Milestone
        {
            ProjectId = projectId,
            Name = request.Name?.Trim() is { Length: > 0 } n
                ? n
                : $"{invoiceNumber} ({coveredFrom.ToString("d MMM", Inv)} to {coveredTo.ToString("d MMM yyyy", Inv)})",
            // Frozen onto the invoice, not read live off the project: editing the
            // project's default next month must not rewrite an invoice already sent.
            Description = request.Description?.Trim() is { Length: > 0 } d
                ? d
                : project.InvoiceWorkDescription,
            Amount = amount,
            Currency = currencies[0],
            Status = MilestoneStatus.Pending,
            DateDue = request.DateDue ?? InvoiceNumberService.DefaultDueDate(project, coveredTo),
            SortOrder = sortOrder + 1,
            InvoiceDate = issued,
            VatRate = vatRate,
            VatAmount = vatAmount,
            Hours = totalHours,
            // Only meaningful when every period billed at the same rate. Across a rate
            // change it stays null and the per-period lines carry the detail.
            RateApplied = distinctRates.Count == 1 ? distinctRates[0] : null,
            PeriodStart = coveredFrom,
            PeriodEnd = coveredTo,
            InvoiceNumber = invoiceNumber,
        };

        // Two writes are needed because the entries need the milestone's generated id.
        // Both happen in one transaction, and the periods are re-checked inside it:
        // two concurrent requests would otherwise each sweep the same unbilled hours
        // and the second would steal them, leaving the first invoice carrying an
        // amount with nothing behind it.
        await using var tx = await db.Database.BeginTransactionAsync();

        var ids = entries.Select(e => e.Id).ToList();
        var stillUnbilled = await db.TimeEntries
            .Where(t => ids.Contains(t.Id) && t.InvoiceMilestoneId == null)
            .ToListAsync();

        if (stillUnbilled.Count != entries.Count)
        {
            await tx.RollbackAsync();
            return Problem(
                title: "Periods Already Invoiced",
                detail: "Some of those periods were invoiced while this request was in flight. Reload and try again.",
                statusCode: 409);
        }

        db.Milestones.Add(invoice);
        var duplicateNumber = false;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // The unique index caught a number this request had already checked was
            // free -- another request took it in between.
            duplicateNumber = true;
        }

        if (duplicateNumber)
        {
            await tx.RollbackAsync();
            return Problem(
                title: "Duplicate Invoice Number",
                detail: $"Invoice {invoiceNumber} was created by another request. Try again.",
                statusCode: 409);
        }

        foreach (var entry in stillUnbilled)
            entry.InvoiceMilestoneId = invoice.Id;
        await db.SaveChangesAsync();

        await tx.CommitAsync();

        // File the PDF against the project so the invoice is where every other client
        // document is, without having to download it and upload it back. Deliberately
        // after the commit and deliberately non-fatal: a renderer that is down must not
        // undo an invoice that is otherwise correct.
        ProjectFile? filed = null;
        var doc = await docs.BuildAsync(projectId, invoice.Id);
        if (doc is not null)
        {
            var pdf = await docs.RenderPdfAsync(doc);
            if (pdf is not null)
                filed = await files.FileInvoiceAsync(projectId, invoice.Id, invoiceNumber, pdf);
        }

        return CreatedAtAction(nameof(GetById), new { projectId, id = invoice.Id },
            new { invoice, periods = stillUnbilled.Count, totalHours, file = filed });
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

        await files.RemoveInvoiceFilesAsync(projectId, id);

        db.Milestones.Remove(invoice);
        await db.SaveChangesAsync();

        return Ok(new { released = entries.Count });
    }
}

public record CreateInvoiceRequest(
    DateOnly From,
    DateOnly To,
    string? InvoiceNumber,
    string? Name,
    string? Description,
    DateOnly? DateDue,
    DateOnly? InvoiceDate);
