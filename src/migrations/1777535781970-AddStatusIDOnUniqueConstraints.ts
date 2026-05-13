import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusIDOnUniqueConstraints1777535781970
  implements MigrationInterface
{
  name = "AddStatusIDOnUniqueConstraints1777535781970";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX \`IDX_wr_warehouse_id\` ON \`warehouse_requirements\` (\`warehouse_id\`)`,
    );
    await queryRunner.query(
      `DROP INDEX \`UQ_wh_id_requirement_id\` ON \`warehouse_requirements\``,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_wh_id_requirement_id_status_id\` ON \`warehouse_requirements\` (\`warehouse_id\`, \`requirement_id\`, \`status_id\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_wr_warehouse_id\` ON \`warehouse_requirements\``,
    );
    await queryRunner.query(
      `DROP INDEX \`UQ_wh_id_requirement_id_status_id\` ON \`warehouse_requirements\``,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`UQ_wh_id_requirement_id\` ON \`warehouse_requirements\` (\`warehouse_id\`, \`requirement_id\`)`,
    );
  }
}
