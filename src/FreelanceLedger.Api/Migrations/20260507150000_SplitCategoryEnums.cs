using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations
{
    /// <inheritdoc />
    public partial class SplitCategoryEnums : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Category",
                table: "Investments",
                type: "INTEGER",
                nullable: false,
                defaultValue: 4);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "Investments");
        }
    }
}
