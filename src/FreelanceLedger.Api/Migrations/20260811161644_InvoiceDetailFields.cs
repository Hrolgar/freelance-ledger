using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceDetailFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InvoiceLineLabel",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceTermsNote",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceWorkDescription",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentDueDayOfMonth",
                table: "Projects",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SourceInvoiceMilestoneId",
                table: "ProjectFiles",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "InvoiceDate",
                table: "Milestones",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvoiceLineLabel",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "InvoiceTermsNote",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "InvoiceWorkDescription",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "PaymentDueDayOfMonth",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "SourceInvoiceMilestoneId",
                table: "ProjectFiles");

            migrationBuilder.DropColumn(
                name: "InvoiceDate",
                table: "Milestones");
        }
    }
}
