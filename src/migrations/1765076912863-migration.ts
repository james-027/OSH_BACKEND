import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765076912863 implements MigrationInterface {
    name = 'Migration1765076912863'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD \`requirement_abbr_name\` varchar(255) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP COLUMN \`requirement_abbr_name\``);
    }

}
