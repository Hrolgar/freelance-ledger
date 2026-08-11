using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Services;

/// Where project files live on disk. Shared so that a file filed automatically by the
/// invoice flow lands in exactly the same place, and shows up in exactly the same list,
/// as one dragged in by hand.
public class ProjectFileStore(LedgerDbContext db, IConfiguration config, ILogger<ProjectFileStore> logger)
{
    public string FilesRoot =>
        config.GetValue<string>("Storage:FilesRoot")
        ?? Path.Combine(AppContext.BaseDirectory, "data", "files");

    public string AbsolutePath(ProjectFile file) => Path.Combine(FilesRoot, file.StorageKey);

    /// Writes bytes into the project's file area and returns the storage key.
    public async Task<string> WriteAsync(int projectId, string extension, Stream content)
    {
        var relativeDir = Path.Combine("projects", projectId.ToString());
        var storageKey = Path.Combine(relativeDir, Guid.NewGuid().ToString("N") + extension);
        Directory.CreateDirectory(Path.Combine(FilesRoot, relativeDir));

        await using var stream = File.Create(Path.Combine(FilesRoot, storageKey));
        await content.CopyToAsync(stream);
        return storageKey;
    }

    /// Files a generated invoice PDF against the project, replacing any copy from an
    /// earlier render of the SAME invoice so re-issuing does not pile up duplicates.
    ///
    /// Never throws: an invoice that was raised correctly must not be rolled back
    /// because the PDF renderer was unavailable. The document is still downloadable
    /// on demand from the invoice row.
    public async Task<ProjectFile?> FileInvoiceAsync(
        int projectId, int invoiceMilestoneId, string invoiceNumber, byte[] pdf)
    {
        try
        {
            var previous = await db.ProjectFiles
                .Where(f => f.ProjectId == projectId
                            && f.SourceInvoiceMilestoneId == invoiceMilestoneId)
                .ToListAsync();
            foreach (var old in previous)
            {
                DeleteBlob(old);
                db.ProjectFiles.Remove(old);
            }

            using var source = new MemoryStream(pdf);
            var storageKey = await WriteAsync(projectId, ".pdf", source);

            var record = new ProjectFile
            {
                ProjectId = projectId,
                OriginalFilename = $"Invoice-{invoiceNumber}.pdf",
                ContentType = "application/pdf",
                SizeBytes = pdf.LongLength,
                StorageKey = storageKey,
                UploadedAt = DateTime.UtcNow,
                SourceInvoiceMilestoneId = invoiceMilestoneId,
            };
            db.ProjectFiles.Add(record);
            await db.SaveChangesAsync();
            return record;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not file invoice {Number} against project {ProjectId}",
                invoiceNumber, projectId);
            return null;
        }
    }

    /// Removes the filed copies of an invoice. Called when the invoice itself is deleted,
    /// so the Files list does not keep offering a document for something that is gone.
    public async Task RemoveInvoiceFilesAsync(int projectId, int invoiceMilestoneId)
    {
        var files = await db.ProjectFiles
            .Where(f => f.ProjectId == projectId && f.SourceInvoiceMilestoneId == invoiceMilestoneId)
            .ToListAsync();
        foreach (var file in files)
        {
            DeleteBlob(file);
            db.ProjectFiles.Remove(file);
        }
    }

    /// Best-effort blob removal. The metadata row goes either way -- a file listed but
    /// missing on disk is worse than a stray blob.
    public void DeleteBlob(ProjectFile file)
    {
        try
        {
            var path = AbsolutePath(file);
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not delete blob for file {FileId}", file.Id);
        }
    }
}
