using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExpogoCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncUiLanguageFluent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "UiLanguage",
                table: "Users",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8,
                oldDefaultValue: "ru");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "UiLanguage",
                table: "Users",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "ru",
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8);
        }
    }
}
