import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWarehouseRequirementDueDate1768746435825 implements MigrationInterface {
    name = 'AddWarehouseRequirementDueDate1768746435825'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` ADD \`warehouse_requirement_due__date\` date NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` DROP COLUMN \`warehouse_requirement_due__date\``);
    }

}
