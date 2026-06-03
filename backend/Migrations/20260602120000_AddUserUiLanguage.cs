using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ExpogoCrm.Api.Data;

#nullable disable

namespace ExpogoCrm.Api.Migrations
{
    [DbContext(typeof(ExpogoDbContext))]
    [Migration("20260602120000_AddUserUiLanguage")]
    /// <inheritdoc />
    public partial class AddUserUiLanguage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UiLanguage",
                table: "Users",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "ru");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UiLanguage",
                table: "Users");
        }
    }
}
