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
    private static readonly CultureInfo NbNo = CultureInfo.GetCultureInfo("nb-NO");

    /// Everything the renderer needs: the body, plus the cover-page fields. The cover is
    /// the first thing the client sees, so it repeats the four facts they actually want
    /// (number, date, total, when it is due) rather than being a bare title page.
    public record InvoiceDocument(
        string Markdown,
        string Title,
        string? Subtitle,
        string ClientLabel,
        List<KeyValuePair<string, string>> Rows,
        string DocType,
        string Lang,
        string? ClientRowLabel,
        string? VendorRowLabel);

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

        // Null means automatic: Norwegian when THIS INVOICE charges VAT, English
        // otherwise. Uses invoice.VatRate (frozen on the milestone), not
        // project.VatRate, so re-downloading an old invoice reproduces the document
        // that was actually sent even after the project's VAT rate later changes.
        // An explicit InvoiceLanguage on the project overrides that.
        var isNo = (project.InvoiceLanguage ?? (invoice.VatRate is not null
                        ? InvoiceLanguage.Norwegian
                        : InvoiceLanguage.English)) == InvoiceLanguage.Norwegian;

        var headingWord = isNo ? "Faktura" : "Invoice";
        var invoiceDateLabel = isNo ? "Fakturadato" : "Invoice date";
        var periodLabel = isNo ? "Periode" : "Period covered";
        var periodConnector = isNo ? "til" : "to";
        var fromLabel = isNo ? "Fra" : "From";
        var billToLabel = isNo ? "Faktureres til" : "Bill to";
        var workHeading = isNo ? "Utført arbeid" : "Work performed";
        var descLabel = isNo ? "Beskrivelse" : "Description";
        var hoursLabel = isNo ? "Timer" : "Hours";
        var rateLabel = isNo ? "Sats" : "Rate";
        var amountLabel = isNo ? "Beløp" : "Amount";
        var defaultRetainerLabel = isNo ? "Månedlig honorar" : "Monthly retainer";
        var defaultHourlyLabel = isNo ? "Konsulenttjenester, timebasert" : "Engineering services, hourly";
        var subtotalLabel = isNo ? "Sum eks. mva" : "Subtotal";
        var vatLabelPrefix = isNo ? "MVA" : "VAT";
        var totalDueLabel = isNo ? "Å betale" : "Total due";
        var paymentHeading = isNo ? "Betalingsinformasjon" : "Payment details";
        var accountHolderLabel = isNo ? "Kontoeier" : "Account holder";
        var paymentRefLabel = isNo ? "Betalingsreferanse" : "Payment reference";
        var closingTemplate = isNo
            ? "Spørsmål om fakturaen? Svar meg direkte på {0}."
            : "Any questions on this invoice, reply to me directly at {0}.";
        var coverInvoiceNumberLabel = isNo ? "Fakturanummer" : "Invoice number";
        var coverInvoiceDateLabel = isNo ? "Fakturadato" : "Invoice date";
        var coverPaidLabel = isNo ? "Betalt" : "Paid";

        string LongDate(DateOnly d) => isNo ? d.ToString("d. MMMM yyyy", NbNo) : d.ToString("d MMMM yyyy", Inv);
        string MonthDate(DateOnly d) => isNo ? d.ToString("d. MMMM", NbNo) : d.ToString("d MMMM", Inv);
        string MonthYearDate(DateOnly d) => isNo ? d.ToString("MMMM yyyy", NbNo) : d.ToString("MMMM yyyy", Inv);
        string ShortDate(DateOnly d) => isNo ? d.ToString("d. MMM", NbNo) : d.ToString("d MMM", Inv);
        string ShortDateYear(DateOnly d) => isNo ? d.ToString("d. MMM yyyy", NbNo) : d.ToString("d MMM yyyy", Inv);
        // Hours and the VAT rate label use the same language as the rest of the document,
        // so a Norwegian page never mixes an invariant "19.5" next to "kr 12 000,00".
        string Num(decimal v) => FormatNum(v, isNo ? NbNo : Inv);

        var cur = invoice.Currency.ToString();
        string Cur(decimal v)
        {
            if (isNo)
            {
                var prefix = invoice.Currency == Currency.NOK ? "kr" : cur;
                return $"{prefix} {v.ToString("N2", NbNo)}";
            }
            return $"{cur} {Money(v)}";
        }

        var sb = new StringBuilder();

        sb.AppendLine($"# {headingWord} {invoice.InvoiceNumber}");
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
            ? $"{periodLabel} {MonthDate(ps)} {periodConnector} {LongDate(pe)}. "
            : "";
        sb.AppendLine(
            $"{invoiceDateLabel} {LongDate(issued)}. {period}{terms}".Trim());
        sb.AppendLine();

        // Address blocks need explicit <br> or the markdown collapses them onto one line.
        sb.AppendLine($"**{fromLabel}**<br>");
        var fromLines = new List<string>();
        foreach (var line in new[] { profile.IssuerName, profile.IssuerAddressLine1,
                                     profile.IssuerAddressLine2, profile.IssuerCountry })
            if (!string.IsNullOrWhiteSpace(line))
                fromLines.Add(line!);
        if (!string.IsNullOrWhiteSpace(profile.IssuerEmail))
            fromLines.Add(profile.IssuerEmail!);
        if (!string.IsNullOrWhiteSpace(profile.OrgNumber))
            fromLines.Add(invoice.VatRate is not null
                ? $"Org.nr. {profile.OrgNumber} MVA"
                : $"Org.nr. {profile.OrgNumber}");
        for (var i = 0; i < fromLines.Count; i++)
            sb.AppendLine(i == fromLines.Count - 1 ? fromLines[i] : $"{fromLines[i]}<br>");
        sb.AppendLine();

        sb.AppendLine($"**{billToLabel}**<br>");
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

        sb.AppendLine($"## {workHeading}");
        sb.AppendLine();
        var work = FirstNonBlank(invoice.Description, project.InvoiceWorkDescription);
        if (work is not null)
        {
            sb.AppendLine(work);
            sb.AppendLine();
        }

        // Hours and rate are meaningless on a retainer invoice, so its table collapses
        // to a plain description/amount line rather than the hourly four columns.
        var isRetainer = project.BillingType == BillingType.Retainer;
        var lineLabel = FirstNonBlank(project.InvoiceLineLabel)
            ?? (isRetainer ? defaultRetainerLabel : defaultHourlyLabel);

        // A totals row continues whichever table was just printed, so it needs the same
        // cell count -- the label and amount always take the last two columns, padded
        // on the left with as many empty cells as the table has beyond those two.
        string TotalsRow(string label, string amount) =>
            isRetainer ? $"| {label} | {amount} |" : $"| | | {label} | {amount} |";

        if (isRetainer)
        {
            sb.AppendLine($"| {descLabel} | {amountLabel} |");
            sb.AppendLine("|---|---:|");
            var invoicePeriodLabel = invoice.PeriodStart is { } rps
                ? $"{lineLabel}, {MonthYearDate(rps)}"
                : lineLabel;
            sb.AppendLine($"| {invoicePeriodLabel} | {Cur(invoice.Amount)} |");
        }
        else
        {
            sb.AppendLine($"| {descLabel} | {hoursLabel} | {rateLabel} | {amountLabel} |");
            sb.AppendLine("|---|---:|---:|---:|");

            var uniformRate = entries.Select(e => e.RateApplied).Distinct().Count() <= 1;
            if (uniformRate && entries.Count > 0)
            {
                // One summary line, matching the invoices already sent.
                var rate = entries[0].RateApplied;
                var hours = entries.Sum(e => e.Hours);
                sb.AppendLine($"| {lineLabel} | {Num(hours)} | "
                              + $"{Cur(rate)} | {Cur(hours * rate)} |");
            }
            else
            {
                // A rate change inside the period: show each period so the total is checkable.
                foreach (var e in entries)
                    sb.AppendLine(
                        $"| {ShortDate(e.PeriodStart)} {periodConnector} {ShortDateYear(e.PeriodEnd)} | {Num(e.Hours)} | "
                        + $"{Cur(e.RateApplied)} | {Cur(e.Hours * e.RateApplied)} |");
            }
        }

        // The organisation number lets VAT be itemised on the document: net, VAT at
        // rate, and the gross total due. The Subtotal/VAT split also drives Hrolgar's
        // own MVA return; see VatAmount.
        if (invoice.VatRate is not null)
        {
            var vatRateLabel = $"{vatLabelPrefix} {Num(invoice.VatRate.Value)} %";
            sb.AppendLine(TotalsRow(subtotalLabel, Cur(invoice.Amount)));
            sb.AppendLine(TotalsRow(vatRateLabel, Cur(invoice.VatAmount ?? 0m)));
            sb.AppendLine(TotalsRow($"**{totalDueLabel}**", $"**{Cur(invoice.TotalDue)}**"));
        }
        else
        {
            sb.AppendLine(TotalsRow($"**{totalDueLabel}**", $"**{Cur(invoice.Amount)}**"));
        }
        sb.AppendLine();

        // profile.VatNote is the sentence explaining why NO VAT is charged. Printing it
        // under a line that just charged VAT would put a flat contradiction on a
        // document going to a client, so it only appears when this invoice charged none.
        // VatNoteNorwegian is a separate sentence for Norwegian documents (e.g. not yet
        // registered in Merverdiavgiftsregisteret) -- it never falls back to VatNote,
        // which is written for foreign business customers.
        var vatNote = isNo ? profile.VatNoteNorwegian : profile.VatNote;
        if (invoice.VatRate is null && !string.IsNullOrWhiteSpace(vatNote))
        {
            sb.AppendLine(vatNote);
            sb.AppendLine();
        }

        var hasBank = !string.IsNullOrWhiteSpace(profile.Iban)
                      || !string.IsNullOrWhiteSpace(profile.AccountHolder);
        if (hasBank)
        {
            sb.AppendLine($"## {paymentHeading}");
            sb.AppendLine();
            var paymentNotes = isNo ? profile.PaymentNotesNorwegian : profile.PaymentNotes;
            if (!string.IsNullOrWhiteSpace(paymentNotes))
            {
                sb.AppendLine(paymentNotes);
                sb.AppendLine();
            }
            // Raw HTML, not a markdown table: markdown insists on a header row, and an
            // empty one renders as a black bar across the page in the house style.
            sb.AppendLine("<table class=\"kv\">");
            Row(accountHolderLabel, profile.AccountHolder);
            Row("Bank", profile.BankName);
            if (isNo && !string.IsNullOrWhiteSpace(profile.AccountNumber))
            {
                Row("Kontonummer", profile.AccountNumber);
            }
            else
            {
                Row("IBAN", profile.Iban);
                Row("BIC / SWIFT", profile.BicSwift);
            }
            Row(paymentRefLabel, invoice.InvoiceNumber);
            sb.AppendLine("</table>");
            sb.AppendLine();
        }

        if (!string.IsNullOrWhiteSpace(profile.IssuerEmail))
            sb.AppendLine(string.Format(closingTemplate, profile.IssuerEmail));

        // --- Cover page ---
        // The client label is the legal entity, first line of Bill to, because that is
        // who the document is addressed to. The display name is often the person.
        var clientLabel = billTo.Count > 0
            ? billTo[0]
            : (project.Client?.Name ?? project.ClientName);

        // The line label already contains commas ("Engineering services, hourly"), so the
        // period hangs off a middot rather than a third comma.
        var coverPeriod = invoice.PeriodStart is { } cps && invoice.PeriodEnd is { } cpe
            ? $" · {MonthDate(cps)} {periodConnector} {LongDate(cpe)}"
            : "";

        var coverRows = new List<KeyValuePair<string, string>>
        {
            new(coverInvoiceNumberLabel, invoice.InvoiceNumber!),
            new(coverInvoiceDateLabel, LongDate(issued)),
        };
        // When VAT applies the cover itemises net, VAT and the gross total the same way
        // the body does, rather than a single gross row. Total due is the GROSS figure,
        // unlike Milestone.Amount which stays net everywhere else.
        if (invoice.VatRate is not null)
        {
            var vatRateLabel = $"{vatLabelPrefix} {Num(invoice.VatRate.Value)} %";
            coverRows.Add(new(subtotalLabel, Cur(invoice.Amount)));
            coverRows.Add(new(vatRateLabel, Cur(invoice.VatAmount ?? 0m)));
            coverRows.Add(new(totalDueLabel, Cur(invoice.TotalDue)));
        }
        else
        {
            coverRows.Add(new(totalDueLabel, Cur(invoice.Amount)));
        }
        // Deliberately no "Payment due" row -- see the note above.
        if (invoice.Status == MilestoneStatus.Paid && invoice.DatePaid is { } paidOn)
            coverRows.Add(new(coverPaidLabel, LongDate(paidOn)));

        return new InvoiceDocument(
            Markdown: sb.ToString(),
            Title: $"{headingWord} {invoice.InvoiceNumber}",
            Subtitle: $"{lineLabel}{coverPeriod}",
            ClientLabel: clientLabel,
            Rows: coverRows,
            DocType: isNo ? "faktura" : "invoice",
            Lang: isNo ? "nb" : "en",
            ClientRowLabel: isNo ? "Kunde" : null,
            VendorRowLabel: isNo ? "Leverandør" : null);

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
            doc_type = doc.DocType,
            lang = doc.Lang,
            meta = new
            {
                title = doc.Title,
                client = doc.ClientLabel,
                subtitle = doc.Subtitle,
                client_label = doc.ClientRowLabel,
                vendor_label = doc.VendorRowLabel,
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
    private static string FormatNum(decimal v, CultureInfo culture) =>
        v == decimal.Truncate(v) ? v.ToString("0", culture) : v.ToString("0.##", culture);
}
