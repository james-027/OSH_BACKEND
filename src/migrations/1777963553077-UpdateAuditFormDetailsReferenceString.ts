import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAuditFormDetailsReferenceString1777963553077 implements MigrationInterface {
    name = 'UpdateAuditFormDetailsReferenceString1777963553077'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP COLUMN \`audit_reference_id\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD \`audit_reference_id\` varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD UNIQUE INDEX \`IDX_f7f90a1b491d40a270f947c291\` (\`audit_reference_id\`)`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP COLUMN \`audit_reference_id\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD \`audit_reference_id\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD UNIQUE INDEX \`IDX_cceca0d6af7bde2ac91c994eb2\` (\`audit_reference_id\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_audit_reference_id\` ON \`audit_form_details\` (\`audit_reference_id\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_audit_reference_id\` ON \`audit_form_details_history\` (\`audit_reference_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_c36311cde57f547fe6585efd25\` ON \`warehouse_employees\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP COLUMN \`audit_reference_id\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD \`audit_reference_id\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_audit_reference_id\` ON \`audit_form_details_history\` (\`audit_reference_id\`)`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP INDEX \`IDX_f7f90a1b491d40a270f947c291\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP COLUMN \`audit_reference_id\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD \`audit_reference_id\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_audit_reference_id\` ON \`audit_form_details\` (\`audit_reference_id\`)`);
    }

}
