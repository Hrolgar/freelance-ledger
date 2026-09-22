using Microsoft.Data.Sqlite;

namespace FreelanceLedger.Api.Services;

/// Nightly SQLite backup through the online backup API (so it is WAL-consistent, unlike
/// a file copy), plus the same routine run synchronously before a migration at boot.
public class BackupHostedService(
    ILogger<BackupHostedService> logger,
    IConfiguration config) : BackgroundService
{
    private const int RetentionDays = 14;
    /// A crash loop or a burst of redeploys must not fill the disk: however young they
    /// are, only this many backups are kept.
    private const int MaxBackups = 30;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromMinutes(2), ct);

        while (!ct.IsCancellationRequested)
        {
            try { BackupNow(config, logger, "nightly"); }
            catch (Exception ex) { logger.LogError(ex, "Backup failed"); }

            try { await Task.Delay(TimeSpan.FromHours(24), ct); }
            catch (TaskCanceledException) { return; }
        }
    }

    /// Takes a backup, verifies it with integrity_check, then prunes by age and count.
    /// Returns the path written, or null when there was nothing to back up. Throws if
    /// the copy could not be written or does not verify, so a caller that is about to
    /// migrate can refuse to.
    public static string? BackupNow(IConfiguration config, ILogger logger, string reason)
    {
        var connectionString = config.GetConnectionString("DefaultConnection")
            ?? "Data Source=ledger.db";

        var builder = new SqliteConnectionStringBuilder(connectionString);
        var sourcePath = builder.DataSource;

        if (!File.Exists(sourcePath))
        {
            logger.LogWarning("Backup ({Reason}): source DB at {Source} does not exist yet, skipping", reason, sourcePath);
            return null;
        }

        var backupRoot = config.GetValue<string>("Storage:BackupsRoot")
            ?? Path.Combine(Path.GetDirectoryName(sourcePath) ?? ".", "backups");
        Directory.CreateDirectory(backupRoot);

        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
        var destPath = Path.Combine(backupRoot, $"ledger-{stamp}-{reason}.db");

        // Pooling=False: Microsoft.Data.Sqlite keeps a pooled handle open after Dispose,
        // which would leave -wal/-shm files next to the copy and keep the premigrate copy
        // open while the migration runs. journal_mode=DELETE folds everything into the
        // one file, so a backup is one file to copy, always.
        using (var source = new SqliteConnection(connectionString))
        using (var dest = new SqliteConnection($"Data Source={destPath};Pooling=False"))
        {
            source.Open();
            dest.Open();
            source.BackupDatabase(dest);

            using (var journal = dest.CreateCommand())
            {
                journal.CommandText = "PRAGMA journal_mode=DELETE;";
                journal.ExecuteNonQuery();
            }

            using var check = dest.CreateCommand();
            check.CommandText = "PRAGMA integrity_check;";
            var verdict = check.ExecuteScalar()?.ToString();
            if (verdict != "ok")
            {
                dest.Close();
                try { File.Delete(destPath); } catch { /* best effort */ }
                throw new InvalidOperationException($"Backup at {destPath} failed integrity_check: {verdict}");
            }
        }

        logger.LogInformation("Backup written ({Reason}): {Dest}", reason, destPath);

        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        var all = Directory.EnumerateFiles(backupRoot, "ledger-*.db")
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.CreationTimeUtc)
            .ToList();
        foreach (var (info, index) in all.Select((f, i) => (f, i)))
        {
            if (info.FullName == destPath) continue;
            if (info.CreationTimeUtc >= cutoff && index < MaxBackups) continue;
            try { info.Delete(); }
            catch (Exception ex) { logger.LogWarning(ex, "Could not prune backup {File}", info.FullName); }
        }

        return destPath;
    }
}
