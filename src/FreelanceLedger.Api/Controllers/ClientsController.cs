using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Controllers;

[ApiController]
[Route("api/clients")]
public class ClientsController(LedgerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var clients = await db.Clients
            .AsNoTracking()
            .Include(c => c.Projects)
                .ThenInclude(p => p.Milestones)
            .Include(c => c.Projects)
                .ThenInclude(p => p.Tips)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Ok(clients);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var client = await db.Clients
            .AsNoTracking()
            .Include(c => c.Projects)
                .ThenInclude(p => p.Milestones)
            .Include(c => c.Projects)
                .ThenInclude(p => p.Tips)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (client is null)
            return Problem(title: "Not Found", detail: $"Client {id} not found.", statusCode: 404);

        return Ok(client);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Client client)
    {
        db.Clients.Add(client);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = client.Id }, client);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Client updated)
    {
        var client = await db.Clients.FindAsync(id);
        if (client is null)
            return Problem(title: "Not Found", detail: $"Client {id} not found.", statusCode: 404);

        client.Name = updated.Name;
        client.Email = updated.Email;
        client.Phone = updated.Phone;
        client.Country = updated.Country;
        client.Timezone = updated.Timezone;
        client.FreelancerId = updated.FreelancerId;
        client.UpworkId = updated.UpworkId;
        client.Notes = updated.Notes;
        client.Aliases = updated.Aliases;

        await db.SaveChangesAsync();
        return Ok(client);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var client = await db.Clients.FindAsync(id);
        if (client is null)
            return Problem(title: "Not Found", detail: $"Client {id} not found.", statusCode: 404);

        db.Clients.Remove(client);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
