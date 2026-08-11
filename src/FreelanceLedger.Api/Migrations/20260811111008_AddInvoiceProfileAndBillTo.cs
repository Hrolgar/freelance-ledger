using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FreelanceLedger.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceProfileAndBillTo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BillTo",
                table: "Projects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InvoiceProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    IssuerName = table.Column<string>(type: "TEXT", nullable: false),
                    IssuerAddressLine1 = table.Column<string>(type: "TEXT", nullable: true),
                    IssuerAddressLine2 = table.Column<string>(type: "TEXT", nullable: true),
                    IssuerCountry = table.Column<string>(type: "TEXT", nullable: true),
                    IssuerEmail = table.Column<string>(type: "TEXT", nullable: true),
                    AccountHolder = table.Column<string>(type: "TEXT", nullable: true),
                    BankName = table.Column<string>(type: "TEXT", nullable: true),
                    Iban = table.Column<string>(type: "TEXT", nullable: true),
                    BicSwift = table.Column<string>(type: "TEXT", nullable: true),
                    PaymentNotes = table.Column<string>(type: "TEXT", nullable: true),
                    VatNote = table.Column<string>(type: "TEXT", nullable: true),
                    TermsNote = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvoiceProfiles", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InvoiceProfiles");

            migrationBuilder.DropColumn(
                name: "BillTo",
                table: "Projects");
        }
    }
}
