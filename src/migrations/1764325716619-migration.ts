import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764325716619 implements MigrationInterface {
    name = 'Migration1764325716619'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`requirement_reminders\` (\`id\` int NOT NULL AUTO_INCREMENT, \`requirement_id\` int NOT NULL, \`reminder_type_id\` int NOT NULL, \`reminder_count_day\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` ADD CONSTRAINT \`FK_d5b6d434dbf4807a9a311b0b54e\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` ADD CONSTRAINT \`FK_e814b04e6ab4213584fa21dd6ef\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` ADD CONSTRAINT \`FK_7bceb83398c0920a59549a8fd3a\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` ADD CONSTRAINT \`FK_1589c3f95c9aa5631fc1d5c653b\` FOREIGN KEY (\`reminder_type_id\`) REFERENCES \`reminder_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` ADD CONSTRAINT \`FK_23a89cc4a092f0ecbe820762bac\` FOREIGN KEY (\`requirement_id\`) REFERENCES \`requirements\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` DROP FOREIGN KEY \`FK_23a89cc4a092f0ecbe820762bac\``);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` DROP FOREIGN KEY \`FK_1589c3f95c9aa5631fc1d5c653b\``);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` DROP FOREIGN KEY \`FK_7bceb83398c0920a59549a8fd3a\``);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` DROP FOREIGN KEY \`FK_e814b04e6ab4213584fa21dd6ef\``);
        await queryRunner.query(`ALTER TABLE \`requirement_reminders\` DROP FOREIGN KEY \`FK_d5b6d434dbf4807a9a311b0b54e\``);
        await queryRunner.query(`DROP TABLE \`requirement_reminders\``);
    }

}
