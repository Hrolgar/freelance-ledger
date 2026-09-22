using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations
{
    /// <inheritdoc />
    public partial class ClientArchived : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                table: "Clients",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsArchived",
                table: "Clients");
        }
    }
}
