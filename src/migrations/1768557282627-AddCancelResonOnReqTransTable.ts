import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCancelResonOnReqTransTable1768557282627 implements MigrationInterface {
    name = 'AddCancelResonOnReqTransTable1768557282627'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD \`cancellation_reason\` text NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP COLUMN \`cancellation_reason\``);
    }

}
