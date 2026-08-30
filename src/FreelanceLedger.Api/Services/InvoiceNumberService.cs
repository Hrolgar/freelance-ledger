using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

/// Invoice numbering and due-date defaults shared by every way an invoice gets raised
/// -- the hourly sweep, the manual retainer raise and the automatic monthly raise --
/// so none of them grows its own copy and they drift apart.
public class InvoiceNumberService(LedgerDbContext db)
{
    /// Next sequential number for the project's prefix within the invoice's year,
    /// e.g. OC-2026-001. Falls back to the project id when no prefix is set.
    public async Task<string> NextAsync(Project project, DateOnly periodStart)
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

    /// The number leaves the database now: it becomes the filed PDF's filename and
    /// rides in a Content-Disposition header on download. A slash or a newline in it
    /// is meaningless on an invoice and a nuisance everywhere else.
    public static bool IsValid(string invoiceNumber) =>
        invoiceNumber.Length <= 40
        && invoiceNumber.All(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '.' or ' ')
        && !invoiceNumber.Contains("..");

    /// When the client pays on a set day of the month, an invoice for July is due on
    /// that day in August. Clamped, so a 31st on a 30-day month lands on the 30th.
    public static DateOnly? DefaultDueDate(Project project, DateOnly coveredTo)
    {
        if (project.PaymentDueDayOfMonth is not { } day) return null;

        var month = new DateOnly(coveredTo.Year, coveredTo.Month, 1).AddMonths(1);
        var clamped = Math.Clamp(day, 1, DateTime.DaysInMonth(month.Year, month.Month));
        return new DateOnly(month.Year, month.Month, clamped);
    }
}
