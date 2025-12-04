import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764837122135 implements MigrationInterface {
    name = 'Migration1764837122135'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`sync_logs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`module\` varchar(255) NOT NULL, \`type\` varchar(255) NOT NULL, \`action\` varchar(255) NOT NULL, \`message\` text NOT NULL, \`row_data\` text NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`sync_logs\``);
    }

}
