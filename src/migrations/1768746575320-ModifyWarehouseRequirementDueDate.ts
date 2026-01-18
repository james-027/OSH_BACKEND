import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyWarehouseRequirementDueDate1768746575320 implements MigrationInterface {
    name = 'ModifyWarehouseRequirementDueDate1768746575320'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` CHANGE \`warehouse_requirement_due__date\` \`warehouse_requirement_due_date\` date NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` CHANGE \`warehouse_requirement_due_date\` \`warehouse_requirement_due__date\` date NULL`);
    }

}
