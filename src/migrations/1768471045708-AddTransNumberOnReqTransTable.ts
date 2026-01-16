import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransNumberOnReqTransTable1768471045708 implements MigrationInterface {
    name = 'AddTransNumberOnReqTransTable1768471045708'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD \`trans_number\` varchar(32) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP COLUMN \`trans_number\``);
    }

}
