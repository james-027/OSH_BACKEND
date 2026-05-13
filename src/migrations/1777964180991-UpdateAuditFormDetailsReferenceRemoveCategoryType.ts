import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAuditFormDetailsReferenceRemoveCategoryType1777964180991 implements MigrationInterface {
    name = 'UpdateAuditFormDetailsReferenceRemoveCategoryType1777964180991'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP COLUMN \`category_type_id\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP COLUMN \`category_type_id\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
