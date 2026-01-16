import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransNumberOnReqTransTable1768484986738 implements MigrationInterface {
    name = 'AddTransNumberOnReqTransTable1768484986738'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD \`location_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_f5a2731f15115557532522333e5\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_f5a2731f15115557532522333e5\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP COLUMN \`location_id\``);
    }

}
