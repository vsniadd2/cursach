using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ExpogoCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesPipelineAndBillingLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsVip",
                table: "SupportTickets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "SalesPipelines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesPipelines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesPipelines_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalesPipelines_TenantId_Name",
                table: "SalesPipelines",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.Sql("""
                INSERT INTO "SalesPipelines" ("TenantId", "Name", "IsDefault", "CreatedAtUtc")
                SELECT t."Id", 'Основная', TRUE, NOW() AT TIME ZONE 'UTC'
                FROM "Tenants" t
                WHERE NOT EXISTS (
                    SELECT 1 FROM "SalesPipelines" sp WHERE sp."TenantId" = t."Id"
                );
                """);

            migrationBuilder.AddColumn<int>(
                name: "PipelineId",
                table: "Deals",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Deals" d
                SET "PipelineId" = sp."Id"
                FROM "SalesPipelines" sp
                WHERE sp."TenantId" = d."TenantId" AND sp."IsDefault" = TRUE;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "PipelineId",
                table: "Deals",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Deals_PipelineId",
                table: "Deals",
                column: "PipelineId");

            migrationBuilder.CreateIndex(
                name: "IX_Deals_TenantId_PipelineId_Stage",
                table: "Deals",
                columns: new[] { "TenantId", "PipelineId", "Stage" });

            migrationBuilder.AddForeignKey(
                name: "FK_Deals_SalesPipelines_PipelineId",
                table: "Deals",
                column: "PipelineId",
                principalTable: "SalesPipelines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Deals_SalesPipelines_PipelineId",
                table: "Deals");

            migrationBuilder.DropTable(
                name: "SalesPipelines");

            migrationBuilder.DropIndex(
                name: "IX_Deals_PipelineId",
                table: "Deals");

            migrationBuilder.DropIndex(
                name: "IX_Deals_TenantId_PipelineId_Stage",
                table: "Deals");

            migrationBuilder.DropColumn(
                name: "IsVip",
                table: "SupportTickets");

            migrationBuilder.DropColumn(
                name: "PipelineId",
                table: "Deals");
        }
    }
}
