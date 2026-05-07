import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAuditFormDetailsReference1777962543105 implements MigrationInterface {
    name = 'UpdateAuditFormDetailsReference1777962543105'

    public async up(queryRunner: QueryRunner): Promise<void> {
    
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` CHANGE \`audit_reference_id\` \`audit_reference_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD UNIQUE INDEX \`IDX_f7f90a1b491d40a270f947c291\` (\`audit_reference_id\`)`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_reference_id\` \`audit_reference_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD UNIQUE INDEX \`IDX_cceca0d6af7bde2ac91c994eb2\` (\`audit_reference_id\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_audit_reference_id\` ON \`audit_form_details\` (\`audit_reference_id\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_audit_reference_id\` ON \`audit_form_details_history\` (\`audit_reference_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
     
        await queryRunner.query(`DROP INDEX \`UQ_audit_reference_id\` ON \`audit_form_details_history\``);
        await queryRunner.query(`DROP INDEX \`UQ_audit_reference_id\` ON \`audit_form_details\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_reference_id\` \`audit_reference_id\` int NULL DEFAULT 'NULL'`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` CHANGE \`audit_reference_id\` \`audit_reference_id\` int NULL DEFAULT 'NULL'`);
    }

}
