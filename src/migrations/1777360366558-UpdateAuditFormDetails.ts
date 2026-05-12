import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAuditFormDetails1777360366558 implements MigrationInterface {
    name = 'UpdateAuditFormDetails1777360366558'

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD \`audit_by\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD \`audit_by\` varchar(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP COLUMN \`audit_by\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP COLUMN \`audit_by\``);

    }

}
