using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ExpogoCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddQuickActionsAndSupportFaq : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DashboardQuickActionsJson",
                table: "Users",
                type: "character varying(4096)",
                maxLength: 4096,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SupportFaqItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: true),
                    Question = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Answer = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportFaqItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportFaqItems_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SupportFaqItems_TenantId_SortOrder",
                table: "SupportFaqItems",
                columns: new[] { "TenantId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SupportFaqItems");

            migrationBuilder.DropColumn(
                name: "DashboardQuickActionsJson",
                table: "Users");
        }
    }
}
