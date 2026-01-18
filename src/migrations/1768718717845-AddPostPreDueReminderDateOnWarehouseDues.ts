import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostPreDueReminderDateOnWarehouseDues1768718717845 implements MigrationInterface {
    name = 'AddPostPreDueReminderDateOnWarehouseDues1768718717845'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` ADD \`warehouse_requirement_due_pre_reminder_date\` date NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` ADD \`warehouse_requirement_due_post_reminder_date\` date NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` DROP COLUMN \`warehouse_requirement_due_post_reminder_date\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` DROP COLUMN \`warehouse_requirement_due_pre_reminder_date\``);
    }

}
