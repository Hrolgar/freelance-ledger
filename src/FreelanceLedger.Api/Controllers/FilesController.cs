using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/files")]
public class FilesController(LedgerDbContext db, IConfiguration config) : ControllerBase
{
    private static readonly string[] AllowedExtensions = { ".pdf", ".docx", ".xlsx", ".pptx", ".md", ".txt", ".zip", ".png", ".jpg", ".jpeg", ".gif", ".csv", ".json" };
    private const long MaxSizeBytes = 25 * 1024 * 1024; // 25 MB

    private string FilesRoot =>
        config.GetValue<string>("Storage:FilesRoot")
        ?? Path.Combine(AppContext.BaseDirectory, "data", "files");

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

        var uuid = Guid.NewGuid().ToString("N");
        var relativeDir = Path.Combine("projects", projectId.ToString());
        var storageKey = Path.Combine(relativeDir, uuid + ext);
        var absoluteDir = Path.Combine(FilesRoot, relativeDir);
        Directory.CreateDirectory(absoluteDir);

        var absolutePath = Path.Combine(FilesRoot, storageKey);
        await using (var stream = System.IO.File.Create(absolutePath))
        {
            await file.CopyToAsync(stream);
        }

        var record = new ProjectFile
        {
            ProjectId = projectId,
            OriginalFilename = Path.GetFileName(file.FileName),
            ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
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

        var path = Path.Combine(FilesRoot, record.StorageKey);
        if (!System.IO.File.Exists(path))
            return Problem(title: "Gone", detail: "File missing on disk.", statusCode: 410);

        var stream = System.IO.File.OpenRead(path);
        if (inline)
        {
            var safeName = record.OriginalFilename.Replace("\"", "_");
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{safeName}\"");
            return File(stream, record.ContentType);
        }
        return File(stream, record.ContentType, record.OriginalFilename);
    }

    [HttpDelete("{fileId:int}")]
    public async Task<IActionResult> Delete(int projectId, int fileId)
    {
        var record = await db.ProjectFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ProjectId == projectId);
        if (record is null)
            return Problem(title: "Not Found", detail: $"File {fileId} not found.", statusCode: 404);

        var path = Path.Combine(FilesRoot, record.StorageKey);
        try { if (System.IO.File.Exists(path)) System.IO.File.Delete(path); }
        catch { /* best-effort; metadata still gets removed */ }

        db.ProjectFiles.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
