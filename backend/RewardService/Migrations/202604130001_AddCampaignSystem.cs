using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using RewardService.Data;

#nullable disable

namespace RewardService.Migrations
{
    [DbContext(typeof(RewardDbContext))]
    [Migration("202604130001_AddCampaignSystem")]
    public partial class AddCampaignSystem : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Campaigns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Priority = table.Column<int>(type: "int", nullable: false),
                    StartAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "(getutcdate())"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "(getutcdate())")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Campaigns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CampaignRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    MinAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    MaxAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    RewardType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    RewardPoints = table.Column<int>(type: "int", nullable: false),
                    CashbackAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CashbackPercent = table.Column<decimal>(type: "decimal(9,4)", nullable: false),
                    MaxCashbackAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "(getutcdate())"),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "(getutcdate())")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignRules_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CampaignRedemptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CampaignId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransactionRef = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    TransactionAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RewardType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    RewardPoints = table.Column<int>(type: "int", nullable: false),
                    CashbackAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    AppliedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "(getutcdate())")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignRedemptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignRedemptions_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Campaigns_Code",
                table: "Campaigns",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Campaigns_IsActive_StartAtUtc_EndAtUtc",
                table: "Campaigns",
                columns: new[] { "IsActive", "StartAtUtc", "EndAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignRedemptions_CampaignId_TransactionRef",
                table: "CampaignRedemptions",
                columns: new[] { "CampaignId", "TransactionRef" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampaignRedemptions_UserId_AppliedAtUtc",
                table: "CampaignRedemptions",
                columns: new[] { "UserId", "AppliedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignRules_CampaignId_TransactionType_IsActive",
                table: "CampaignRules",
                columns: new[] { "CampaignId", "TransactionType", "IsActive" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignRedemptions");

            migrationBuilder.DropTable(
                name: "CampaignRules");

            migrationBuilder.DropTable(
                name: "Campaigns");
        }
    }
}
