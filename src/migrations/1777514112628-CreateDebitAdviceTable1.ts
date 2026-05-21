import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDebitAdviceTable11777514112628 implements MigrationInterface {
    name = 'CreateDebitAdviceTable11777514112628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`debit_advice_line\` DROP FOREIGN KEY \`FK_2cada1dad9ead4bfd38020c1043\``);
        await queryRunner.query(`CREATE TABLE \`debit_advice_gl_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`line_id\` int NOT NULL, \`ref_docno\` varchar(255) NULL, \`profitcenter_code\` varchar(255) NOT NULL, \`gl_code\` varchar(100) NOT NULL, \`Remarks\` varchar(500) NOT NULL, \`amount\` decimal(18,2) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`debit_advice_gl_items\` ADD CONSTRAINT \`FK_3fad40c6b3e2f54766ca5f5a248\` FOREIGN KEY (\`line_id\`) REFERENCES \`debit_advice_line\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`debit_advice_gl_items\` ADD CONSTRAINT \`FK_d9a6a2343615384d0fcb6c4b806\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`debit_advice_gl_items\` DROP FOREIGN KEY \`FK_d9a6a2343615384d0fcb6c4b806\``);
        await queryRunner.query(`ALTER TABLE \`debit_advice_gl_items\` DROP FOREIGN KEY \`FK_3fad40c6b3e2f54766ca5f5a248\``);
        await queryRunner.query(`DROP TABLE \`debit_advice_gl_items\``);
        await queryRunner.query(`ALTER TABLE \`debit_advice_line\` ADD CONSTRAINT \`FK_2cada1dad9ead4bfd38020c1043\` FOREIGN KEY (\`ref_docno\`) REFERENCES \`debit_advice\`(\`document_number\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
