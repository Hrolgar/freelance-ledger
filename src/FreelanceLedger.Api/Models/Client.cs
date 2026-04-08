namespace FreelanceLedger.Api.Models;

public class Client
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Country { get; set; }
    public string? Timezone { get; set; }
    public string? FreelancerId { get; set; }
    public string? UpworkId { get; set; }
    public string? Notes { get; set; }

    // Comma-separated aliases (nick111nick111, NickO, etc.)
    public string? Aliases { get; set; }

    public ICollection<Project> Projects { get; set; } = [];
}
