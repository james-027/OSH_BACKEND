import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764248214144 implements MigrationInterface {
    name = 'Migration1764248214144'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`requirements\` (\`id\` int NOT NULL AUTO_INCREMENT, \`requirement_name\` varchar(255) NOT NULL, \`renewal_type_id\` int NOT NULL, \`requirement_reminder\` int NOT NULL COMMENT 'The number of days before the requirement is due to send a reminder.', \`requirement_start\` int NOT NULL COMMENT 'Start (number of month) to start counting the requirement from.', \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_requirement_name\` (\`requirement_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD CONSTRAINT \`FK_e2d32dc1aa552fa8721736894ba\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD CONSTRAINT \`FK_afc6283e2c7fceb95837ae7871f\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD CONSTRAINT \`FK_35b20c77eb5e13d2c6c219b9c61\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD CONSTRAINT \`FK_d587bfaaf96350300bfa7c3dd82\` FOREIGN KEY (\`renewal_type_id\`) REFERENCES \`renewal_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP FOREIGN KEY \`FK_d587bfaaf96350300bfa7c3dd82\``);
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP FOREIGN KEY \`FK_35b20c77eb5e13d2c6c219b9c61\``);
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP FOREIGN KEY \`FK_afc6283e2c7fceb95837ae7871f\``);
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP FOREIGN KEY \`FK_e2d32dc1aa552fa8721736894ba\``);
        await queryRunner.query(`DROP INDEX \`UQ_requirement_name\` ON \`requirements\``);
        await queryRunner.query(`DROP TABLE \`requirements\``);
    }

}
