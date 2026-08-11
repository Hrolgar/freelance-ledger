using System.Diagnostics;
using System.Globalization;
using System.Text;
using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

/// Builds the invoice document. The markdown here is the same shape as the invoices
/// already sent by hand, and is rendered to PDF by the vendored Consulting Bold
/// renderer in invoice-renderer/ so generated invoices match the ones already issued.
public class InvoiceDocumentService(LedgerDbContext db, ILogger<InvoiceDocumentService> logger)
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    /// Everything the renderer needs: the body, plus the cover-page fields. The cover is
    /// the first thing the client sees, so it repeats the four facts they actually want
    /// (number, date, total, when it is due) rather than being a bare title page.
    public record InvoiceDocument(
        string Markdown,
        string Title,
        string? Subtitle,
        string ClientLabel,
        List<KeyValuePair<string, string>> Rows);

    public async Task<string?> BuildMarkdownAsync(int projectId, int invoiceId)
        => (await BuildAsync(projectId, invoiceId))?.Markdown;

    public async Task<InvoiceDocument?> BuildAsync(int projectId, int invoiceId)
    {
        var invoice = await db.Milestones
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == invoiceId
                                      && m.ProjectId == projectId
                                      && m.InvoiceNumber != null);
        if (invoice is null)
            return null;

        var project = await db.Projects
            .AsNoTracking()
            .Include(p => p.Client)
            .FirstAsync(p => p.Id == projectId);

        var entries = await db.TimeEntries
            .AsNoTracking()
            .Where(t => t.InvoiceMilestoneId == invoiceId)
            .OrderBy(t => t.PeriodStart)
            .ToListAsync();

        var profile = await db.InvoiceProfiles.AsNoTracking().FirstOrDefaultAsync()
                      ?? new InvoiceProfile { IssuerName = "Not configured" };

        var cur = invoice.Currency.ToString();
        var sb = new StringBuilder();

        sb.AppendLine($"# Invoice {invoice.InvoiceNumber}");
        sb.AppendLine();

        // Stamped when the invoice was raised, never "today". Re-downloading an invoice
        // months later has to reproduce the document that was actually sent.
        var issued = invoice.InvoiceDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // NO PAYMENT DUE DATE ON THE DOCUMENT. Hrolgar's decision 2026-08-11: he does not
        // want a due date indicated to the client. `Milestone.DateDue` is still set and
        // still drives the overdue flagging inside the ledger -- it is simply never
        // printed, and neither is a cover row for it.
        //
        // The terms note survives as an optional free sentence, printed VERBATIM. It used
        // to be a clause interpolated onto the due date ("per the SOW"), which no longer
        // has anything to hang off. Blank, which is how it currently is, prints nothing.
        var termsNote = FirstNonBlank(project.InvoiceTermsNote, profile.TermsNote);
        var terms = termsNote is null
            ? ""
            : (termsNote.EndsWith('.') ? termsNote : termsNote + ".");

        // A milestone can carry an invoice number without a period if it was typed in
        // by hand rather than generated, so the period clause is optional.
        var period = invoice.PeriodStart is { } ps && invoice.PeriodEnd is { } pe
            ? $"Period covered {ps.ToString("d MMMM", Inv)} to {pe.ToString("d MMMM yyyy", Inv)}. "
            : "";
        sb.AppendLine(
            $"Invoice date {issued.ToString("d MMMM yyyy", Inv)}. {period}{terms}".Trim());
        sb.AppendLine();

        // Address blocks need explicit <br> or the markdown collapses them onto one line.
        sb.AppendLine("**From**<br>");
        foreach (var line in new[] { profile.IssuerName, profile.IssuerAddressLine1,
                                     profile.IssuerAddressLine2, profile.IssuerCountry })
            if (!string.IsNullOrWhiteSpace(line))
                sb.AppendLine($"{line}<br>");
        if (!string.IsNullOrWhiteSpace(profile.IssuerEmail))
            sb.AppendLine(profile.IssuerEmail);
        sb.AppendLine();

        sb.AppendLine("**Bill to**<br>");
        List<string> billTo;
        if (!string.IsNullOrWhiteSpace(project.BillTo))
        {
            // Explicit override wins: the legal entity, not the display name.
            billTo = project.BillTo
                .Replace("\r\n", "\n")
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }
        else
        {
            billTo = [];
            if (!string.IsNullOrWhiteSpace(project.Client?.Name)) billTo.Add(project.Client!.Name);
            else if (!string.IsNullOrWhiteSpace(project.ClientName)) billTo.Add(project.ClientName);
            if (!string.IsNullOrWhiteSpace(project.Client?.Country)) billTo.Add(project.Client!.Country!);
        }
        for (var i = 0; i < billTo.Count; i++)
            sb.AppendLine(i == billTo.Count - 1 ? billTo[i] : $"{billTo[i]}<br>");
        sb.AppendLine();

        sb.AppendLine("## Work performed");
        sb.AppendLine();
        var work = FirstNonBlank(invoice.Description, project.InvoiceWorkDescription);
        if (work is not null)
        {
            sb.AppendLine(work);
            sb.AppendLine();
        }

        var lineLabel = FirstNonBlank(project.InvoiceLineLabel) ?? "Engineering services, hourly";

        sb.AppendLine("| Description | Hours | Rate | Amount |");
        sb.AppendLine("|---|---:|---:|---:|");

        var uniformRate = entries.Select(e => e.RateApplied).Distinct().Count() <= 1;
        if (uniformRate && entries.Count > 0)
        {
            // One summary line, matching the invoices already sent.
            var rate = entries[0].RateApplied;
            var hours = entries.Sum(e => e.Hours);
            sb.AppendLine($"| {lineLabel} | {Num(hours)} | "
                          + $"{cur} {Money(rate)} | {cur} {Money(hours * rate)} |");
        }
        else
        {
            // A rate change inside the period: show each period so the total is checkable.
            foreach (var e in entries)
                sb.AppendLine(
                    $"| {e.PeriodStart.ToString("d MMM", Inv)} to {e.PeriodEnd.ToString("d MMM yyyy", Inv)} | {Num(e.Hours)} | "
                    + $"{cur} {Money(e.RateApplied)} | {cur} {Money(e.Hours * e.RateApplied)} |");
        }

        sb.AppendLine($"| | | **Total due** | **{cur} {Money(invoice.Amount)}** |");
        sb.AppendLine();

        if (!string.IsNullOrWhiteSpace(profile.VatNote))
        {
            sb.AppendLine(profile.VatNote);
            sb.AppendLine();
        }

        var hasBank = !string.IsNullOrWhiteSpace(profile.Iban)
                      || !string.IsNullOrWhiteSpace(profile.AccountHolder);
        if (hasBank)
        {
            sb.AppendLine("## Payment details");
            sb.AppendLine();
            if (!string.IsNullOrWhiteSpace(profile.PaymentNotes))
            {
                sb.AppendLine(profile.PaymentNotes);
                sb.AppendLine();
            }
            // Raw HTML, not a markdown table: markdown insists on a header row, and an
            // empty one renders as a black bar across the page in the house style.
            sb.AppendLine("<table class=\"kv\">");
            Row("Account holder", profile.AccountHolder);
            Row("Bank", profile.BankName);
            Row("IBAN", profile.Iban);
            Row("BIC / SWIFT", profile.BicSwift);
            Row("Payment reference", invoice.InvoiceNumber);
            sb.AppendLine("</table>");
            sb.AppendLine();
        }

        if (!string.IsNullOrWhiteSpace(profile.IssuerEmail))
            sb.AppendLine($"Any questions on this invoice, reply to me directly at {profile.IssuerEmail}.");

        // --- Cover page ---
        // The client label is the legal entity, first line of Bill to, because that is
        // who the document is addressed to. The display name is often the person.
        var clientLabel = billTo.Count > 0
            ? billTo[0]
            : (project.Client?.Name ?? project.ClientName);

        // The line label already contains commas ("Engineering services, hourly"), so the
        // period hangs off a middot rather than a third comma.
        var coverPeriod = invoice.PeriodStart is { } cps && invoice.PeriodEnd is { } cpe
            ? $" · {cps.ToString("d MMMM", Inv)} to {cpe.ToString("d MMMM yyyy", Inv)}"
            : "";

        var coverRows = new List<KeyValuePair<string, string>>
        {
            new("Invoice number", invoice.InvoiceNumber!),
            new("Invoice date", issued.ToString("d MMMM yyyy", Inv)),
            new("Total due", $"{cur} {Money(invoice.Amount)}"),
        };
        // Deliberately no "Payment due" row -- see the note above.
        if (invoice.Status == MilestoneStatus.Paid && invoice.DatePaid is { } paidOn)
            coverRows.Add(new("Paid", paidOn.ToString("d MMMM yyyy", Inv)));

        return new InvoiceDocument(
            Markdown: sb.ToString(),
            Title: $"Invoice {invoice.InvoiceNumber}",
            Subtitle: $"{lineLabel}{coverPeriod}",
            ClientLabel: clientLabel,
            Rows: coverRows);

        void Row(string label, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                sb.AppendLine($"<tr><th>{Escape(label)}</th><td>{Escape(value)}</td></tr>");
        }
    }

    /// Bank details are free text typed in Settings and land in raw HTML, so an
    /// ampersand in a bank name has to survive rather than start an entity.
    private static string Escape(string value) => System.Net.WebUtility.HtmlEncode(value);

    /// First value that is neither null nor whitespace, trimmed. Null when there is none.
    private static string? FirstNonBlank(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    /// Renders the markdown to PDF with the vendored Consulting Bold renderer.
    /// Returns null when the renderer is unavailable, so callers can fall back to
    /// offering the markdown instead of failing outright.
    public async Task<byte[]?> RenderPdfAsync(InvoiceDocument doc)
    {
        var renderer = FindRenderer();
        if (renderer is null)
        {
            logger.LogWarning("Invoice renderer not found; PDF unavailable");
            return null;
        }

        var outPath = Path.Combine(Path.GetTempPath(), $"invoice-{Guid.NewGuid():N}.pdf");
        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            markdown = doc.Markdown,
            output_path = outPath,
            meta = new
            {
                title = doc.Title,
                client = doc.ClientLabel,
                subtitle = doc.Subtitle,
                // The renderer takes rows as [label, value] pairs, in order.
                rows = doc.Rows.Select(r => new[] { r.Key, r.Value }).ToArray(),
            },
        });

        try
        {
            var psi = new ProcessStartInfo("python3", renderer)
            {
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            using var proc = Process.Start(psi)!;
            await proc.StandardInput.WriteAsync(payload);
            proc.StandardInput.Close();

            var stderr = await proc.StandardError.ReadToEndAsync();
            await proc.WaitForExitAsync();

            if (proc.ExitCode != 0 || !File.Exists(outPath))
            {
                logger.LogError("Invoice renderer failed (exit {Code}): {Err}", proc.ExitCode, stderr);
                return null;
            }

            var bytes = await File.ReadAllBytesAsync(outPath);
            return bytes;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Invoice renderer could not be started");
            return null;
        }
        finally
        {
            if (File.Exists(outPath))
                try { File.Delete(outPath); } catch { /* temp file */ }
        }
    }

    private static string? FindRenderer()
    {
        // Container layout first, then the repo layout for local dev.
        foreach (var candidate in new[]
                 {
                     "/app/invoice-renderer/render_invoice.py",
                     Path.Combine(AppContext.BaseDirectory, "invoice-renderer", "render_invoice.py"),
                     Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..",
                                  "invoice-renderer", "render_invoice.py"),
                 })
        {
            var full = Path.GetFullPath(candidate);
            if (File.Exists(full))
                return full;
        }
        return null;
    }

    private static string Money(decimal v) => v.ToString("N2", Inv);

    /// Hours print without trailing zeros: 19.5 not 19.50, 20 not 20.00.
    private static string Num(decimal v) =>
        v == decimal.Truncate(v) ? v.ToString("0", Inv) : v.ToString("0.##", Inv);
}
