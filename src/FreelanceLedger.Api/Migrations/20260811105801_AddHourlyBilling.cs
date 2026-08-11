using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddHourlyBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BillingType",
                table: "Projects",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Cadence",
                table: "Projects",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "CommittedHours",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoicePrefix",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Hours",
                table: "Milestones",
                type: "TEXT",
                precision: 9,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "Milestones",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "PeriodEnd",
                table: "Milestones",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "PeriodStart",
                table: "Milestones",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RateApplied",
                table: "Milestones",
                type: "TEXT",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectRates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProjectId = table.Column<int>(type: "INTEGER", nullable: false),
                    Rate = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<int>(type: "INTEGER", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectRates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectRates_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TimeEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProjectId = table.Column<int>(type: "INTEGER", nullable: false),
                    PeriodStart = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    PeriodEnd = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    Hours = table.Column<decimal>(type: "TEXT", precision: 9, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    RateApplied = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<int>(type: "INTEGER", nullable: false),
                    InvoiceMilestoneId = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TimeEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TimeEntries_Milestones_InvoiceMilestoneId",
                        column: x => x.InvoiceMilestoneId,
                        principalTable: "Milestones",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TimeEntries_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectRates_ProjectId_EffectiveFrom",
                table: "ProjectRates",
                columns: new[] { "ProjectId", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_TimeEntries_InvoiceMilestoneId",
                table: "TimeEntries",
                column: "InvoiceMilestoneId");

            migrationBuilder.CreateIndex(
                name: "IX_TimeEntries_ProjectId_PeriodStart",
                table: "TimeEntries",
                columns: new[] { "ProjectId", "PeriodStart" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectRates");

            migrationBuilder.DropTable(
                name: "TimeEntries");

            migrationBuilder.DropColumn(
                name: "BillingType",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "Cadence",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "CommittedHours",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "InvoicePrefix",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "Hours",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "PeriodEnd",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "PeriodStart",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "RateApplied",
                table: "Milestones");
        }
    }
}
