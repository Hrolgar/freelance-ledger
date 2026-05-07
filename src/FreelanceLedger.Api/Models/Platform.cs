using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace FreelanceLedger.Api.Models;

public class Platform
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    public decimal DefaultFeePercentage { get; set; }

    public bool IsLocked { get; set; }

    public string? Notes { get; set; }

    [JsonIgnore]
    public ICollection<Project> Projects { get; set; } = [];
}
