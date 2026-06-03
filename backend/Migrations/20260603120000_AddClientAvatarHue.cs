using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExpogoCrm.Api.Migrations;

public partial class AddClientAvatarHue : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "AvatarHue",
            table: "Clients",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.Sql("""UPDATE "Clients" SET "AvatarHue" = ("Id" * 47) % 360 WHERE "AvatarHue" = 0;""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "AvatarHue",
            table: "Clients");
    }
}
