using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using FreelanceLedger.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/files")]
public class FilesController(LedgerDbContext db, ProjectFileStore store) : ControllerBase
{
    // The served Content-Type comes from THIS table, never from the upload's own header:
    // a .txt declared as text/html would otherwise be rendered as a page on the ledger's
    // origin, with the session cookie, when opened inline.
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        [".md"] = "text/plain; charset=utf-8",
        [".txt"] = "text/plain; charset=utf-8",
        [".zip"] = "application/zip",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".csv"] = "text/csv; charset=utf-8",
        [".json"] = "application/json",
    };
    private static readonly string[] AllowedExtensions = ContentTypes.Keys.ToArray();
    private static readonly string[] InlineTypes = { "application/pdf", "image/png", "image/jpeg", "image/gif" };
    private const long MaxSizeBytes = 25 * 1024 * 1024; // 25 MB

    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists) return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        var files = await db.ProjectFiles
            .AsNoTracking()
            .Where(f => f.ProjectId == projectId)
            .OrderByDescending(f => f.UploadedAt)
            .ToListAsync();

        return Ok(files);
    }

    [HttpPost]
    [RequestSizeLimit(MaxSizeBytes + 1024 * 1024)]
    public async Task<IActionResult> Upload(int projectId, IFormFile file)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == projectId);
        if (!exists) return Problem(title: "Not Found", detail: $"Project {projectId} not found.", statusCode: 404);

        if (file is null || file.Length == 0)
            return Problem(title: "Bad Request", detail: "Empty upload.", statusCode: 400);

        if (file.Length > MaxSizeBytes)
            return Problem(title: "Payload Too Large", detail: $"Max size is {MaxSizeBytes / 1024 / 1024} MB.", statusCode: 413);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            return Problem(title: "Unsupported Media Type", detail: $"Extension '{ext}' not allowed.", statusCode: 415);

        await using var upload = file.OpenReadStream();
        var storageKey = await store.WriteAsync(projectId, ext, upload);

        var record = new ProjectFile
        {
            ProjectId = projectId,
            OriginalFilename = Path.GetFileName(file.FileName),
            ContentType = ContentTypes[ext],
            SizeBytes = file.Length,
            StorageKey = storageKey,
            UploadedAt = DateTime.UtcNow,
        };
        db.ProjectFiles.Add(record);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { projectId }, record);
    }

    [HttpGet("{fileId:int}/download")]
    public async Task<IActionResult> Download(int projectId, int fileId, [FromQuery] bool inline = false)
    {
        var record = await db.ProjectFiles.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ProjectId == projectId);
        if (record is null)
            return Problem(title: "Not Found", detail: $"File {fileId} not found.", statusCode: 404);

        var path = store.AbsolutePath(record);
        if (!System.IO.File.Exists(path))
            return Problem(title: "Gone", detail: "File missing on disk.", statusCode: 410);

        // Older rows stored whatever type the browser sent; re-derive from the extension.
        var ext = Path.GetExtension(record.StorageKey).ToLowerInvariant();
        var contentType = ContentTypes.TryGetValue(ext, out var known) ? known : "application/octet-stream";

        var stream = System.IO.File.OpenRead(path);
        if (inline && InlineTypes.Contains(contentType))
        {
            var safeName = record.OriginalFilename.Replace("\"", "_").Replace("\r", "").Replace("\n", "");
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{safeName}\"");
            return File(stream, contentType);
        }
        return File(stream, contentType, record.OriginalFilename);
    }

    [HttpDelete("{fileId:int}")]
    public async Task<IActionResult> Delete(int projectId, int fileId)
    {
        var record = await db.ProjectFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ProjectId == projectId);
        if (record is null)
            return Problem(title: "Not Found", detail: $"File {fileId} not found.", statusCode: 404);

        store.DeleteBlob(record);

        db.ProjectFiles.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
