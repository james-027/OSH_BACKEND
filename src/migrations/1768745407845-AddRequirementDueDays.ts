import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRequirementDueDays1768745407845 implements MigrationInterface {
    name = 'AddRequirementDueDays1768745407845'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD \`requirement_due_days\` int NOT NULL COMMENT 'Due days (number of days) to due counting the requirement from.'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP COLUMN \`requirement_due_days\``);
    }

}
