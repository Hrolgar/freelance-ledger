using Microsoft.Data.Sqlite;

namespace FreelanceLedger.Api.Services;

public class BackupHostedService(
    ILogger<BackupHostedService> logger,
    IConfiguration config) : BackgroundService
{
    private const int RetentionDays = 14;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromMinutes(2), ct);

        while (!ct.IsCancellationRequested)
        {
            try { await PerformBackup(); }
            catch (Exception ex) { logger.LogError(ex, "Backup failed"); }

            try { await Task.Delay(TimeSpan.FromHours(24), ct); }
            catch (TaskCanceledException) { return; }
        }
    }

    private async Task PerformBackup()
    {
        var connectionString = config.GetConnectionString("DefaultConnection")
            ?? "Data Source=ledger.db";

        var builder = new SqliteConnectionStringBuilder(connectionString);
        var sourcePath = builder.DataSource;

        if (!File.Exists(sourcePath))
        {
            logger.LogWarning("Backup: source DB at {Source} does not exist yet, skipping", sourcePath);
            return;
        }

        var backupRoot = config.GetValue<string>("Storage:BackupsRoot")
            ?? Path.Combine(Path.GetDirectoryName(sourcePath) ?? ".", "backups");
        Directory.CreateDirectory(backupRoot);

        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
        var destPath = Path.Combine(backupRoot, $"ledger-{stamp}.db");

        await using (var source = new SqliteConnection(connectionString))
        await using (var dest = new SqliteConnection($"Data Source={destPath}"))
        {
            await source.OpenAsync();
            await dest.OpenAsync();
            source.BackupDatabase(dest);
        }

        logger.LogInformation("Backup written: {Dest}", destPath);

        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        foreach (var file in Directory.EnumerateFiles(backupRoot, "ledger-*.db"))
        {
            var info = new FileInfo(file);
            if (info.CreationTimeUtc < cutoff)
            {
                try { info.Delete(); }
                catch (Exception ex) { logger.LogWarning(ex, "Could not prune backup {File}", file); }
            }
        }
    }
}
