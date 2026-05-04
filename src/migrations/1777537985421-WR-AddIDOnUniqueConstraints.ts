import { MigrationInterface, QueryRunner } from "typeorm";

export class WRAddIDOnUniqueConstraints1777537985421 implements MigrationInterface {
    name = 'WRAddIDOnUniqueConstraints1777537985421'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_wh_id_requirement_id_status_id\` ON \`warehouse_requirements\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_id_wh_id_requirement_id_status_id\` ON \`warehouse_requirements\` (\`id\`, \`warehouse_id\`, \`requirement_id\`, \`status_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_id_wh_id_requirement_id_status_id\` ON \`warehouse_requirements\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_wh_id_requirement_id_status_id\` ON \`warehouse_requirements\` (\`warehouse_id\`, \`requirement_id\`, \`status_id\`)`);
    }

}
