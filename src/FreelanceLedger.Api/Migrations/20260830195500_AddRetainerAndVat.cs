using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRetainerAndVat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoRaiseInvoice",
                table: "Projects",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                table: "Projects",
                type: "TEXT",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VatAmount",
                table: "Milestones",
                type: "TEXT",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                table: "Milestones",
                type: "TEXT",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DefaultVatRate",
                table: "InvoiceProfiles",
                type: "TEXT",
                precision: 5,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoRaiseInvoice",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "VatRate",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "VatAmount",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "VatRate",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "DefaultVatRate",
                table: "InvoiceProfiles");
        }
    }
}
