import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764855459383 implements MigrationInterface {
    name = 'Migration1764855459383'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`req_transaction_details\` (\`id\` int NOT NULL AUTO_INCREMENT, \`req_transaction_header_id\` int NOT NULL, \`requirement_file_path\` text NOT NULL, \`requirement_file_name\` text NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`req_transaction_dues\` (\`id\` int NOT NULL AUTO_INCREMENT, \`req_transaction_header_id\` int NOT NULL, \`warehouse_requirement_due_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`req_transaction_headers\` (\`id\` int NOT NULL AUTO_INCREMENT, \`warehouse_id\` int NOT NULL, \`requirement_id\` int NOT NULL, \`trans_date\` date NOT NULL, \`trans_remarks\` text NULL, \`trans_due_status_id\` int NOT NULL DEFAULT '1', \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` ADD CONSTRAINT \`FK_bcbf80828783019b1cb81d43b26\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` ADD CONSTRAINT \`FK_936e55357a26a217abe2485d933\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` ADD CONSTRAINT \`FK_c5799b843f3e230a8edd0e7ea8e\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` ADD CONSTRAINT \`FK_b6acd390d99356986b11c278cec\` FOREIGN KEY (\`req_transaction_header_id\`) REFERENCES \`req_transaction_headers\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` ADD CONSTRAINT \`FK_960ce09655f33ba3355fa0a92f7\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` ADD CONSTRAINT \`FK_aa7b45fa48b6106c2161920990c\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` ADD CONSTRAINT \`FK_9d6135833a0dc151e899f49b20a\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` ADD CONSTRAINT \`FK_51c359948ec6090873484613ac3\` FOREIGN KEY (\`req_transaction_header_id\`) REFERENCES \`req_transaction_headers\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` ADD CONSTRAINT \`FK_6ec05e3fd8d58b2ba2398d09dbb\` FOREIGN KEY (\`warehouse_requirement_due_id\`) REFERENCES \`warehouse_requirement_dues\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_f620c6657ce3fad54a4c7f4a1e0\` FOREIGN KEY (\`trans_due_status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_362b6c25a6580b9965d1446670c\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_8bec80c9e6af88d5229053223e7\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_bdefacad9521ed4938fdbb31796\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_74f4fb371216e047595945e0133\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` ADD CONSTRAINT \`FK_65c63898b588ed6f9e77e1d4819\` FOREIGN KEY (\`requirement_id\`) REFERENCES \`requirements\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_65c63898b588ed6f9e77e1d4819\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_74f4fb371216e047595945e0133\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_bdefacad9521ed4938fdbb31796\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_8bec80c9e6af88d5229053223e7\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_362b6c25a6580b9965d1446670c\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_headers\` DROP FOREIGN KEY \`FK_f620c6657ce3fad54a4c7f4a1e0\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` DROP FOREIGN KEY \`FK_6ec05e3fd8d58b2ba2398d09dbb\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` DROP FOREIGN KEY \`FK_51c359948ec6090873484613ac3\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` DROP FOREIGN KEY \`FK_9d6135833a0dc151e899f49b20a\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` DROP FOREIGN KEY \`FK_aa7b45fa48b6106c2161920990c\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_dues\` DROP FOREIGN KEY \`FK_960ce09655f33ba3355fa0a92f7\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` DROP FOREIGN KEY \`FK_b6acd390d99356986b11c278cec\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` DROP FOREIGN KEY \`FK_c5799b843f3e230a8edd0e7ea8e\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` DROP FOREIGN KEY \`FK_936e55357a26a217abe2485d933\``);
        await queryRunner.query(`ALTER TABLE \`req_transaction_details\` DROP FOREIGN KEY \`FK_bcbf80828783019b1cb81d43b26\``);
        await queryRunner.query(`DROP TABLE \`req_transaction_headers\``);
        await queryRunner.query(`DROP TABLE \`req_transaction_dues\``);
        await queryRunner.query(`DROP TABLE \`req_transaction_details\``);
    }

}
