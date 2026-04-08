using FreelanceLedger.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace FreelanceLedger.Api.Data;

public class LedgerDbContext(DbContextOptions<LedgerDbContext> options) : DbContext(options)
{
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Milestone> Milestones => Set<Milestone>();
    public DbSet<Tip> Tips => Set<Tip>();
    public DbSet<Cost> Costs => Set<Cost>();
    public DbSet<Investment> Investments => Set<Investment>();
    public DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Client>(e =>
        {
            e.HasKey(c => c.Id);
            e.HasMany(c => c.Projects)
                .WithOne(p => p.Client)
                .HasForeignKey(p => p.ClientId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.FeePercentage).HasPrecision(5, 2);
            e.HasMany(p => p.Milestones)
                .WithOne(m => m.Project)
                .HasForeignKey(m => m.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(p => p.Tips)
                .WithOne(t => t.Project)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Milestone>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.Amount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Tip>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Amount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Cost>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Amount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Investment>(e =>
        {
            e.HasKey(i => i.Id);
            e.Property(i => i.Amount).HasPrecision(18, 2);
            e.Property(i => i.NokRate).HasPrecision(18, 6);
        });

        modelBuilder.Entity<ExchangeRate>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Rate).HasPrecision(18, 6);
            e.HasIndex(r => new { r.Currency, r.Month, r.Year }).IsUnique();
        });
    }
}
