import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyVatCodeInSalesTrans1781748942943
  implements MigrationInterface
{
  name = "ModifyVatCodeInSalesTrans1781748942943";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sales_transactions\` CHANGE \`vat_cdoe\` \`vat_code\` varchar(255) NOT NULL`,
    );
    // await queryRunner.query(`ALTER TABLE \`sales_transactions\` DROP COLUMN \`vat_code\``);
    // await queryRunner.query(`ALTER TABLE \`sales_transactions\` ADD \`vat_code\` varchar(255) NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // await queryRunner.query(`ALTER TABLE \`sales_transactions\` DROP COLUMN \`vat_code\``);
    // await queryRunner.query(`ALTER TABLE \`sales_transactions\` ADD \`vat_code\` varchar(255) NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE \`sales_transactions\` CHANGE \`vat_code\` \`vat_cdoe\` varchar(255) NOT NULL`,
    );
  }
}
