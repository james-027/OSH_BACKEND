import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAuditFormDetailsReferenceRemoveCategoryType1777964180991
  implements MigrationInterface
{
  name = "UpdateAuditFormDetailsReferenceRemoveCategoryType1777964180991";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_e9a978af5e7fdf20ed63a77ba78\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP COLUMN \`category_type_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_44a3082fccec17db2a3b41fa355\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP COLUMN \`category_type_id\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` ADD \`category_type_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_44a3082fccec17db2a3b41fa355\` FOREIGN KEY (\`category_type_id\`) REFERENCES \`category_type\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` ADD \`category_type_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_e9a978af5e7fdf20ed63a77ba78\` FOREIGN KEY (\`category_type_id\`) REFERENCES \`category_type\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
