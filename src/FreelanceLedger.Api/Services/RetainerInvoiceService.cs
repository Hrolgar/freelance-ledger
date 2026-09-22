using System.Globalization;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

/// Raises a retainer invoice: the monthly fee resolved from the project's ProjectRate
/// history, stamped with VAT and filed as a PDF, exactly like an hourly invoice is a
/// Milestone under the hood. Called by the manual "raise" action in InvoicesController
/// AND by RetainerInvoiceHostedService's daily sweep -- one implementation, so the
/// button and the automatic raise cannot silently diverge.
public class RetainerInvoiceService(
    LedgerDbContext db,
    RateResolutionService rates,
    InvoiceNumberService invoiceNumbers,
    InvoiceDocumentService docs,
    ProjectFileStore files)
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    public enum RaiseStatus { Ok, NoRateInForce, PeriodOverlap, InvalidInvoiceNumber, DuplicateInvoiceNumber }

    public record RaiseResult(RaiseStatus Status, string? Detail, Milestone? Invoice = null, ProjectFile? File = null);

    public async Task<RaiseResult> RaiseAsync(
        Project project,
        DateOnly periodStart,
        DateOnly periodEnd,
        string? invoiceNumberOverride = null,
        string? name = null,
        string? description = null,
        DateOnly? dateDue = null,
        DateOnly? invoiceDate = null)
    {
        // The panel cannot raise anything until a fee exists -- there is nothing to
        // bill, and silently raising a zero invoice would be worse than refusing.
        var rate = await rates.ResolveAsync(project.Id, periodStart);
        if (rate is null)
            return new RaiseResult(RaiseStatus.NoRateInForce,
                $"No monthly fee is set for this project on {periodStart:yyyy-MM-dd}. Set the monthly fee first.");

        var invoiceNumber = string.IsNullOrWhiteSpace(invoiceNumberOverride)
            ? await invoiceNumbers.NextAsync(project, periodStart)
            : invoiceNumberOverride.Trim();

        if (!InvoiceNumberService.IsValid(invoiceNumber))
            return new RaiseResult(RaiseStatus.InvalidInvoiceNumber,
                "Use up to 40 letters, digits, spaces, dots, dashes or underscores.");

        var vatRate = project.VatRate;
        var vatAmount = VatCalculator.Amount(rate.Rate, vatRate);
        var issued = invoiceDate ?? Clock.Today;

        // A retainer has no TimeEntry rows, so InvoiceMilestoneId can't guard against
        // double-billing the way it does on the hourly path. The overlap check below is
        // the replacement, and it has to run inside the same transaction as the insert:
        // a double-click or the background sweep racing the button must not both pass
        // the check before either has written its row.
        await using var tx = await db.Database.BeginTransactionAsync();

        var overlap = await db.Milestones.AnyAsync(m =>
            m.ProjectId == project.Id
            && m.InvoiceNumber != null
            && m.PeriodStart <= periodEnd
            && m.PeriodEnd >= periodStart);
        if (overlap)
        {
            await tx.RollbackAsync();
            return new RaiseResult(RaiseStatus.PeriodOverlap,
                $"An invoice already covers part of {periodStart:yyyy-MM-dd} to {periodEnd:yyyy-MM-dd}.");
        }

        var sortOrder = await db.Milestones
            .Where(m => m.ProjectId == project.Id)
            .MaxAsync(m => (int?)m.SortOrder) ?? 0;

        var invoice = new Milestone
        {
            ProjectId = project.Id,
            Name = name?.Trim() is { Length: > 0 } n
                ? n
                : $"{invoiceNumber} ({periodStart.ToString("MMMM yyyy", Inv)})",
            // Frozen onto the invoice, not read live off the project: editing the
            // project's default next month must not rewrite an invoice already sent.
            Description = description?.Trim() is { Length: > 0 } d
                ? d
                : project.InvoiceWorkDescription,
            Amount = rate.Rate,
            Currency = rate.Currency,
            Status = MilestoneStatus.Pending,
            DateDue = dateDue ?? InvoiceNumberService.DefaultDueDate(project, periodEnd),
            SortOrder = sortOrder + 1,
            InvoiceDate = issued,
            Hours = null,
            RateApplied = rate.Rate,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            InvoiceNumber = invoiceNumber,
            VatRate = vatRate,
            VatAmount = vatAmount,
        };

        db.Milestones.Add(invoice);
        var duplicateNumber = false;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // The unique index caught a number this call had already checked was free --
            // another request took it in between.
            duplicateNumber = true;
        }

        if (duplicateNumber)
        {
            await tx.RollbackAsync();
            return new RaiseResult(RaiseStatus.DuplicateInvoiceNumber,
                $"Invoice {invoiceNumber} was created by another request. Try again.");
        }

        await tx.CommitAsync();

        // Filed after the commit and deliberately non-fatal: a renderer that is down
        // must not undo an invoice that is otherwise correct.
        ProjectFile? filed = null;
        var doc = await docs.BuildAsync(project.Id, invoice.Id);
        if (doc is not null)
        {
            var pdf = await docs.RenderPdfAsync(doc);
            if (pdf is not null)
                filed = await files.FileInvoiceAsync(project.Id, invoice.Id, invoiceNumber, pdf);
        }

        return new RaiseResult(RaiseStatus.Ok, null, invoice, filed);
    }
}
