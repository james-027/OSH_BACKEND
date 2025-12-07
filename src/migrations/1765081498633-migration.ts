import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765081498633 implements MigrationInterface {
    name = 'Migration1765081498633'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD \`access_key_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` ADD \`access_key_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_b2398cd3950ed2f71242430af59\` FOREIGN KEY (\`access_key_id\`) REFERENCES \`access_key\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` ADD CONSTRAINT \`FK_b32e136718b988dcc78b36be5bf\` FOREIGN KEY (\`access_key_id\`) REFERENCES \`access_key\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` DROP FOREIGN KEY \`FK_b32e136718b988dcc78b36be5bf\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_b2398cd3950ed2f71242430af59\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` DROP COLUMN \`access_key_id\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP COLUMN \`access_key_id\``);
    }

}
