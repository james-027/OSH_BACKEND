import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSystemDocumentations1769660697035 implements MigrationInterface {
    name = 'AddSystemDocumentations1769660697035'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`system_documentations\` (\`id\` int NOT NULL AUTO_INCREMENT, \`system_id\` int NOT NULL, \`file_name\` varchar(255) NOT NULL, \`file_path\` varchar(500) NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`system_documentations\` ADD CONSTRAINT \`FK_a6863cdb05b04cf8d22a1f8b727\` FOREIGN KEY (\`system_id\`) REFERENCES \`systems\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`system_documentations\` ADD CONSTRAINT \`FK_74df764c067aef5e66fd413789f\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`system_documentations\` ADD CONSTRAINT \`FK_03e610df9934ac6dd6f1907027a\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`system_documentations\` ADD CONSTRAINT \`FK_7be3c041ae2a071230430ade728\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`system_documentations\` DROP FOREIGN KEY \`FK_7be3c041ae2a071230430ade728\``);
        await queryRunner.query(`ALTER TABLE \`system_documentations\` DROP FOREIGN KEY \`FK_03e610df9934ac6dd6f1907027a\``);
        await queryRunner.query(`ALTER TABLE \`system_documentations\` DROP FOREIGN KEY \`FK_74df764c067aef5e66fd413789f\``);
        await queryRunner.query(`ALTER TABLE \`system_documentations\` DROP FOREIGN KEY \`FK_a6863cdb05b04cf8d22a1f8b727\``);
        await queryRunner.query(`DROP TABLE \`system_documentations\``);
    }

}
