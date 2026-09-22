using FreelanceLedger.Api.Data;
using FreelanceLedger.Api.Services;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<LedgerDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=ledger.db"));

builder.Services
    .AddControllers(options =>
    {
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });
// Ten seconds is generous for one JSON document; the default of 100 held a Settings
// request open for the whole outage.
builder.Services.AddHttpClient<ExchangeRateService>(client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddScoped<ExchangeRateService>();
builder.Services.AddScoped<RateResolutionService>();
builder.Services.AddScoped<InvoiceDocumentService>();
builder.Services.AddScoped<ProjectFileStore>();
builder.Services.AddScoped<InvoiceNumberService>();
builder.Services.AddScoped<RetainerInvoiceService>();
builder.Services.AddHostedService<BackupHostedService>();
builder.Services.AddHostedService<RetainerInvoiceHostedService>();
builder.Services.AddHealthChecks().AddDbContextCheck<LedgerDbContext>();
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5179",
                "http://10.69.1.100:5179")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LedgerDbContext>();
    // SQLite's __EFMigrationsLock is a table row that does NOT auto-release on crash
    // (unlike SQL Server's session applock). This app is single-instance, so any lock
    // present at startup is stale -- clear it before migrating so an unclean shutdown
    // (e.g. host reboot mid-startup) can't deadlock the next boot.
    db.Database.ExecuteSqlRaw("DROP TABLE IF EXISTS \"__EFMigrationsLock\";");

    // A schema change lands on the only copy of the books. Take a verified backup FIRST,
    // and refuse to migrate if that backup cannot be written: a boot that stops here is
    // recoverable, a half-applied migration on live data is not.
    if (db.Database.GetPendingMigrations().Any())
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        BackupHostedService.BackupNow(app.Configuration, logger, "premigrate");
    }
    db.Database.Migrate();
}

// Defence in depth behind the reverse proxy: Authentik's forward-auth adds
// X-authentik-username to every request it has let through, so a request on the API
// without it did not come through the gate (a published port on the LAN, a misrouted
// Traefik rule). Off in Development, and switchable off with Ledger:RequireAuthHeader.
var requireAuthHeader = app.Configuration.GetValue<bool?>("Ledger:RequireAuthHeader")
                        ?? !app.Environment.IsDevelopment();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";

    var path = context.Request.Path;
    var gated = path.StartsWithSegments("/api") || path.StartsWithSegments("/scalar") || path.StartsWithSegments("/openapi");
    if (requireAuthHeader && gated && string.IsNullOrEmpty(context.Request.Headers["X-authentik-username"]))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsync("Sign in through the ledger's address; direct access to the API is not allowed.");
        return;
    }

    await next();
});

app.MapOpenApi();
app.MapScalarApiReference();

if (app.Environment.IsDevelopment())
{
    app.UseCors();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

// SPA fallback — any non-API route serves the React app
app.MapFallbackToFile("index.html");

app.Run();
