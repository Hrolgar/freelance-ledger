using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/platforms")]
public class PlatformsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var platforms = await db.Platforms
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync();

        return Ok(platforms);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var platform = await db.Platforms
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (platform is null)
            return Problem(title: "Not Found", detail: $"Platform {id} not found.", statusCode: 404);

        return Ok(platform);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Platform platform)
    {
        var exists = await db.Platforms.AnyAsync(p => p.Name == platform.Name);
        if (exists)
            return Problem(title: "Conflict", detail: $"A platform named '{platform.Name}' already exists.", statusCode: 400);

        db.Platforms.Add(platform);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = platform.Id }, platform);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Platform updated)
    {
        var platform = await db.Platforms.FindAsync(id);
        if (platform is null)
            return Problem(title: "Not Found", detail: $"Platform {id} not found.", statusCode: 404);

        var nameConflict = await db.Platforms.AnyAsync(p => p.Name == updated.Name && p.Id != id);
        if (nameConflict)
            return Problem(title: "Conflict", detail: $"A platform named '{updated.Name}' already exists.", statusCode: 400);

        platform.Name = updated.Name;
        platform.DefaultFeePercentage = updated.DefaultFeePercentage;
        platform.IsLocked = updated.IsLocked;
        platform.Notes = updated.Notes;

        await db.SaveChangesAsync();
        return Ok(platform);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var platform = await db.Platforms.FindAsync(id);
        if (platform is null)
            return Problem(title: "Not Found", detail: $"Platform {id} not found.", statusCode: 404);

        var projectCount = await db.Projects.CountAsync(p => p.PlatformId == id);
        if (projectCount > 0)
            return Problem(
                title: "Conflict",
                detail: $"Cannot delete platform '{platform.Name}' — {projectCount} project{(projectCount == 1 ? "" : "s")} reference it. Reassign them first.",
                statusCode: 409);

        db.Platforms.Remove(platform);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
