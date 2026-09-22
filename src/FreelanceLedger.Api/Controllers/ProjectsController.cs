using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects")]
public class ProjectsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var projects = await db.Projects
            .AsNoTracking()
            .Include(p => p.Client)
            .Include(p => p.Platform)
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .Include(p => p.Files)
            .ToListAsync();

        return Ok(projects);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var project = await db.Projects
            .AsNoTracking()
            .Include(p => p.Client)
            .Include(p => p.Platform)
            .Include(p => p.Milestones.OrderBy(m => m.SortOrder))
            .Include(p => p.Tips)
            .Include(p => p.Files.OrderByDescending(f => f.UploadedAt))
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        return Ok(project);
    }

    [HttpGet("{id}/summary")]
    public async Task<IActionResult> GetSummary(int id)
    {
        var project = await db.Projects
            .AsNoTracking()
            .Include(p => p.Milestones)
            .Include(p => p.Tips)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        var paidMilestoneTotal = project.Milestones
            .Where(m => m.Status == MilestoneStatus.Paid)
            .Sum(m => m.Amount);

        var tipTotal = project.Tips.Sum(t => t.Amount);

        var gross = paidMilestoneTotal + tipTotal;
        var fee = gross * (project.FeePercentage / 100m);
        var net = gross - fee;

        var pipelineTotal = project.Milestones.Sum(m => m.Amount) + tipTotal;
        var outstanding = pipelineTotal - paidMilestoneTotal - tipTotal;
        var outstandingNet = outstanding - (outstanding * project.FeePercentage / 100m);

        return Ok(new ProjectSummaryResponse(
            id,
            paidMilestoneTotal,
            tipTotal,
            gross,
            fee,
            net,
            pipelineTotal,
            outstanding,
            outstandingNet,
            project.InitialFullPrice,
            project.Currency));
    }

    [HttpPost]
    public async Task<IActionResult> Create(Project project)
    {
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Project updated)
    {
        var project = await db.Projects.FindAsync(id);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        if (updated.VatRate is { } vatRate && (vatRate < 0 || vatRate > 100))
            return Problem(
                title: "Invalid VAT Rate",
                detail: "VAT rate must be between 0 and 100.",
                statusCode: 400);

        // ClientId, not just ClientName. Without it, reassigning a project to another
        // client changed the name on screen but left the foreign key pointing at the old
        // one, so the Clients page kept crediting the revenue to the wrong client.
        if (updated.Currency != project.Currency)
        {
            // Every milestone, tip and rate row carries the project's currency and every
            // report converts row by row. Changing the project's currency under existing
            // money would relabel nothing and mislead everything; it has to be a fresh
            // project, or the rows are corrected first.
            var hasMoney = await db.Milestones.AnyAsync(m => m.ProjectId == id)
                           || await db.Tips.AnyAsync(t => t.ProjectId == id)
                           || await db.ProjectRates.AnyAsync(r => r.ProjectId == id);
            if (hasMoney)
                return Problem(
                    title: "Currency Locked",
                    detail: "This project already has milestones, tips or rates in " + project.Currency + ". Delete those first, or create a new project in the other currency.",
                    statusCode: 409);
        }

        project.ClientId = updated.ClientId;
        project.ClientName = updated.ClientName;
        project.ProjectName = updated.ProjectName;
        project.PlatformId = updated.PlatformId;
        project.Currency = updated.Currency;
        project.FeePercentage = updated.FeePercentage;
        project.InitialFullPrice = updated.InitialFullPrice;
        project.Status = updated.Status;
        project.DateAwarded = updated.DateAwarded;
        project.DateCompleted = updated.DateCompleted;
        project.Notes = updated.Notes;
        project.BillingType = updated.BillingType;
        project.InvoicePrefix = updated.InvoicePrefix;
        project.BillTo = updated.BillTo;
        project.Cadence = updated.Cadence;
        project.CommittedHours = updated.CommittedHours;
        project.InvoiceWorkDescription = updated.InvoiceWorkDescription;
        project.InvoiceLineLabel = updated.InvoiceLineLabel;
        project.PaymentDueDayOfMonth = updated.PaymentDueDayOfMonth;
        project.InvoiceTermsNote = updated.InvoiceTermsNote;
        project.VatRate = updated.VatRate;
        project.InvoiceLanguage = updated.InvoiceLanguage;
        project.AutoRaiseInvoice = updated.AutoRaiseInvoice;

        await db.SaveChangesAsync();
        return Ok(project);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, [FromServices] ProjectFileStore files)
    {
        var project = await db.Projects
            .Include(p => p.Milestones)
            .Include(p => p.Files)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (project is null)
            return Problem(title: "Not Found", detail: $"Project {id} not found.", statusCode: 404);

        // Paid money is history the year overview, the CSV and the VAT return are built
        // on. The milestone and invoice routes refuse to delete it one row at a time; the
        // project route used to take all of it in one confirm. Mark the project Paid or
        // On hold instead.
        var paid = project.Milestones.Count(m => m.Status == MilestoneStatus.Paid);
        if (paid > 0)
            return Problem(
                title: "Project Has Paid History",
                detail: $"{project.ProjectName} has {paid} paid milestone{(paid == 1 ? "" : "s")}. A project with paid money cannot be deleted; set its status to Archived to tidy it away.",
                statusCode: 409);

        // The rows cascade; the bytes on disk do not. Remove the blobs first so nothing
        // is orphaned under /data/files if the delete then goes through.
        foreach (var file in project.Files.ToList())
            files.DeleteBlob(file);

        db.Projects.Remove(project);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record ProjectSummaryResponse(
    int ProjectId,
    decimal PaidMilestoneTotal,
    decimal TipTotal,
    decimal Gross,
    decimal Fee,
    decimal Net,
    decimal PipelineTotal,
    decimal Outstanding,
    decimal OutstandingNet,
    decimal? InitialFullPrice,
    Currency Currency);
