import { MigrationInterface, QueryRunner } from "typeorm";

export class CheckStaleMigration1778668149144 implements MigrationInterface {
    name = 'CheckStaleMigration1778668149144'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_f7f90a1b491d40a270f947c291\` ON \`audit_form_details\``);
        await queryRunner.query(`DROP INDEX \`IDX_cceca0d6af7bde2ac91c994eb2\` ON \`audit_form_details_history\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP COLUMN \`audit_by\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD \`audit_by\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP COLUMN \`audit_by\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD \`audit_by\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP COLUMN \`contact_number\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD \`contact_number\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_ff633c8edb72431de80437fc831\` FOREIGN KEY (\`audit_by\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_0869e4e31d56598775827945e13\` FOREIGN KEY (\`audit_by\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_0869e4e31d56598775827945e13\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_ff633c8edb72431de80437fc831\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP COLUMN \`contact_number\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD \`contact_number\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP COLUMN \`audit_by\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD \`audit_by\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP COLUMN \`audit_by\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD \`audit_by\` varchar(255) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_cceca0d6af7bde2ac91c994eb2\` ON \`audit_form_details_history\` (\`audit_reference_id\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_f7f90a1b491d40a270f947c291\` ON \`audit_form_details\` (\`audit_reference_id\`)`);
    }

}
