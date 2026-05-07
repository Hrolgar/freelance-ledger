using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations;

public partial class PlatformsEntityAndDropEnum : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1. Create Platforms table
        migrationBuilder.CreateTable(
            name: "Platforms",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                Name = table.Column<string>(type: "TEXT", nullable: false),
                DefaultFeePercentage = table.Column<decimal>(type: "TEXT", precision: 5, scale: 2, nullable: false),
                IsLocked = table.Column<bool>(type: "INTEGER", nullable: false),
                Notes = table.Column<string>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Platforms", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Platforms_Name",
            table: "Platforms",
            column: "Name",
            unique: true);

        // 2. Seed Freelancer and Private
        migrationBuilder.InsertData(
            table: "Platforms",
            columns: new[] { "Name", "DefaultFeePercentage", "IsLocked", "Notes" },
            values: new object[,]
            {
                { "Freelancer", 10m, true, null },
                { "Private", 0m, false, null }
            });

        // 3. Add PlatformId column
        migrationBuilder.AddColumn<int>(
            name: "PlatformId",
            table: "Projects",
            type: "INTEGER",
            nullable: true);

        // 4. Backfill: enum value 0 = Freelancer, 1 = Upwork, 2 = Direct, 3 = Other
        // Map all 12 live projects (all Platform=0 = Freelancer) to seeded Freelancer platform.
        migrationBuilder.Sql("UPDATE Projects SET PlatformId = (SELECT Id FROM Platforms WHERE Name = 'Freelancer') WHERE Platform = 0;");
        migrationBuilder.Sql("UPDATE Projects SET PlatformId = (SELECT Id FROM Platforms WHERE Name = 'Private') WHERE Platform = 2;");
        // Upwork (1) and Other (3) remain null — user reassigns in UI if any exist.

        // 5. Drop the old Platform enum column
        migrationBuilder.DropColumn(
            name: "Platform",
            table: "Projects");

        // 6. Add the FK + index now that the column is populated
        migrationBuilder.CreateIndex(
            name: "IX_Projects_PlatformId",
            table: "Projects",
            column: "PlatformId");

        migrationBuilder.AddForeignKey(
            name: "FK_Projects_Platforms_PlatformId",
            table: "Projects",
            column: "PlatformId",
            principalTable: "Platforms",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey("FK_Projects_Platforms_PlatformId", "Projects");
        migrationBuilder.DropIndex("IX_Projects_PlatformId", "Projects");
        migrationBuilder.AddColumn<int>("Platform", "Projects", type: "INTEGER", nullable: false, defaultValue: 0);
        migrationBuilder.Sql("UPDATE Projects SET Platform = 0 WHERE PlatformId = (SELECT Id FROM Platforms WHERE Name = 'Freelancer');");
        migrationBuilder.Sql("UPDATE Projects SET Platform = 2 WHERE PlatformId = (SELECT Id FROM Platforms WHERE Name = 'Private');");
        migrationBuilder.DropColumn("PlatformId", "Projects");
        migrationBuilder.DropTable("Platforms");
    }
}
