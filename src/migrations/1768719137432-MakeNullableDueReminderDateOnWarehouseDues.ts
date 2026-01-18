import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeNullableDueReminderDateOnWarehouseDues1768719137432 implements MigrationInterface {
    name = 'MakeNullableDueReminderDateOnWarehouseDues1768719137432'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` CHANGE \`warehouse_requirement_due_pre_reminder_date\` \`warehouse_requirement_due_pre_reminder_date\` date NULL`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` CHANGE \`warehouse_requirement_due_post_reminder_date\` \`warehouse_requirement_due_post_reminder_date\` date NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` CHANGE \`warehouse_requirement_due_post_reminder_date\` \`warehouse_requirement_due_post_reminder_date\` date NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` CHANGE \`warehouse_requirement_due_pre_reminder_date\` \`warehouse_requirement_due_pre_reminder_date\` date NOT NULL`);
    }

}
