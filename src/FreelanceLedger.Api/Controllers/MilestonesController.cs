using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/milestones")]
public class MilestonesController(LedgerDbContext db, ProjectFileStore files) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var milestones = await db.Milestones
            .AsNoTracking()
            .Include(m => m.Project)
            .Where(m => m.ProjectId == projectId)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        return Ok(milestones);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int projectId, int id)
    {
        var milestone = await db.Milestones
            .AsNoTracking()
            .Include(m => m.Project)
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        return Ok(milestone);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int projectId, Milestone milestone)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists)
            return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var project = await db.Projects.AsNoTracking().FirstAsync(p => p.Id == projectId);
        if (milestone.Currency != project.Currency)
            return Problem(
                title: "Currency Mismatch",
                detail: $"This project is billed in {project.Currency}; a milestone in {milestone.Currency} would be converted wrongly everywhere.",
                statusCode: 400);
        if (milestone.Amount < 0)
            return Problem(title: "Invalid Amount", detail: "Amount cannot be negative.", statusCode: 400);
        if (milestone.Status == MilestoneStatus.Paid && milestone.DatePaid is null)
            milestone.DatePaid = Clock.Today;

        // A milestone typed in by hand is never an invoice. The invoice-only fields are
        // set by the invoice routes, which validate the number and snapshot the VAT; bound
        // straight from the body they let an unvalidated number in and a duplicate one
        // surface as a 500 from the unique index.
        milestone.Id = 0;
        milestone.ProjectId = projectId;
        milestone.InvoiceNumber = null;
        milestone.InvoiceDate = null;
        milestone.VatRate = null;
        milestone.VatAmount = null;
        milestone.Hours = null;
        milestone.RateApplied = null;
        milestone.PeriodStart = null;
        milestone.PeriodEnd = null;
        db.Milestones.Add(milestone);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { projectId, id = milestone.Id }, milestone);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int projectId, int id, Milestone updated)
    {
        var milestone = await db.Milestones
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        var project = await db.Projects.AsNoTracking().FirstAsync(p => p.Id == projectId);
        if (updated.Currency != project.Currency)
            return Problem(
                title: "Currency Mismatch",
                detail: $"This project is billed in {project.Currency}.",
                statusCode: 400);
        if (updated.Amount < 0)
            return Problem(title: "Invalid Amount", detail: "Amount cannot be negative.", statusCode: 400);

        if (milestone.InvoiceNumber is not null)
        {
            // An invoice is frozen: its amount, currency and VAT were snapshotted when it
            // was raised and a PDF with them is already with the client. Names, dates and
            // status may still move; the money may not.
            if (milestone.Status == MilestoneStatus.Paid && updated.Status == MilestoneStatus.Paid
                && (updated.Amount != milestone.Amount || updated.Currency != milestone.Currency))
                return Problem(
                    title: "Invoice Paid",
                    detail: $"Invoice {milestone.InvoiceNumber} is paid and cannot be changed.",
                    statusCode: 409);
            if (updated.Amount != milestone.Amount || updated.Currency != milestone.Currency)
                return Problem(
                    title: "Invoice Frozen",
                    detail: $"Invoice {milestone.InvoiceNumber} carries the amount it was raised for. Delete the invoice and raise it again to change the money on it.",
                    statusCode: 409);
        }

        milestone.Name = updated.Name;
        milestone.Description = updated.Description;
        milestone.Amount = updated.Amount;
        milestone.Currency = updated.Currency;
        milestone.Status = updated.Status;
        milestone.DateDue = updated.DateDue;
        milestone.DatePaid = updated.Status == MilestoneStatus.Paid
            ? updated.DatePaid ?? milestone.DatePaid ?? Clock.Today
            : null;
        milestone.SortOrder = updated.SortOrder;

        await db.SaveChangesAsync();
        return Ok(milestone);
    }

    [HttpPatch("~/api/milestones/{id:int}")]
    public async Task<IActionResult> Patch(int id, [FromBody] MilestonePatchRequest patch)
    {
        var milestone = await db.Milestones.FindAsync(id);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        if (patch.Status.HasValue)
            milestone.Status = patch.Status.Value;

        if (patch.DatePaid.HasValue)
            milestone.DatePaid = patch.DatePaid.Value;

        if (patch.DateDue.HasValue)
            milestone.DateDue = patch.DateDue.Value;

        // Paid money without a paid date belongs to no month, so it never reached the
        // year overview, the CSV or the VAT return. Money that stops being paid has no
        // paid date either.
        if (milestone.Status == MilestoneStatus.Paid && milestone.DatePaid is null)
            milestone.DatePaid = Clock.Today;
        if (milestone.Status != MilestoneStatus.Paid && patch.Status.HasValue)
            milestone.DatePaid = null;

        await db.SaveChangesAsync();
        return Ok(milestone);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var milestone = await db.Milestones
            .FirstOrDefaultAsync(m => m.Id == id && m.ProjectId == projectId);

        if (milestone is null)
            return Problem(title: "Not Found", detail: $"Milestone {id} not found.", statusCode: 404);

        // A generated invoice is a milestone, so this route could otherwise delete a
        // PAID invoice that the invoices route refuses to touch. Same rule both ways.
        if (milestone.InvoiceNumber is not null && milestone.Status == MilestoneStatus.Paid)
            return Problem(
                title: "Invoice Paid",
                detail: $"Milestone {id} is invoice {milestone.InvoiceNumber} and is marked paid. Change its status first if you really mean to remove it.",
                statusCode: 409);

        // Raising an invoice files a PDF against the project. The invoices route removes
        // it on delete; without this, deleting the same milestone through THIS route left
        // the document in the Files list forever, pointing at an invoice that is gone.
        // The time entries look after themselves: the foreign key is ON DELETE SET NULL.
        if (milestone.InvoiceNumber is not null)
            await files.RemoveInvoiceFilesAsync(projectId, id);

        db.Milestones.Remove(milestone);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record MilestonePatchRequest(MilestoneStatus? Status, DateOnly? DatePaid, DateOnly? DateDue);
