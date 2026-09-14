using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations
{
    /// <inheritdoc />
    public partial class VatNoteNorwegian : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "VatNoteNorwegian",
                table: "InvoiceProfiles",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VatNoteNorwegian",
                table: "InvoiceProfiles");
        }
    }
}
