import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764387071958 implements MigrationInterface {
    name = 'Migration1764387071958'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD \`requirement_start_days\` int NOT NULL COMMENT 'Start (number of days) to start counting the requirement from.'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP COLUMN \`requirement_start_days\``);
    }

}
