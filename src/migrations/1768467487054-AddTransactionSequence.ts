import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionSequence1768467487054 implements MigrationInterface {
    name = 'AddTransactionSequence1768467487054'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`transaction_sequences\` (\`id\` int NOT NULL AUTO_INCREMENT, \`transaction_type\` varchar(50) NOT NULL, \`location_id\` int NOT NULL, \`access_key_id\` int NOT NULL, \`year\` int NOT NULL, \`current_sequence\` int NOT NULL DEFAULT '0', \`reset_per_year\` tinyint NOT NULL DEFAULT 1, \`format_template\` varchar(255) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_7a8a6adfbc39af3e225a21de1e\` (\`transaction_type\`), UNIQUE INDEX \`IDX_6fd7c197461364da5623b9aaf0\` (\`transaction_type\`, \`location_id\`, \`access_key_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_6fd7c197461364da5623b9aaf0\` ON \`transaction_sequences\``);
        await queryRunner.query(`DROP INDEX \`IDX_7a8a6adfbc39af3e225a21de1e\` ON \`transaction_sequences\``);
        await queryRunner.query(`DROP TABLE \`transaction_sequences\``);
    }

}
