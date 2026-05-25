import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDebitAdviceTable1777433253510 implements MigrationInterface {
    name = 'CreateDebitAdviceTable1777433253510'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`debit_advice\` ADD \`document_number\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` ADD UNIQUE INDEX \`IDX_ed613f018d6722b7e8b7b33ad3\` (\`document_number\`)`);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` ADD \`transaction_date\` date NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`debit_advice_line\` CHANGE \`ref_docno\` \`ref_docno\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` DROP FOREIGN KEY \`FK_56cebf27332352c5c2b5f30c719\``);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` CHANGE \`status_id\` \`status_id\` int NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE \`debit_advice_line\` ADD CONSTRAINT \`FK_2cada1dad9ead4bfd38020c1043\` FOREIGN KEY (\`ref_docno\`) REFERENCES \`debit_advice\`(\`document_number\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` ADD CONSTRAINT \`FK_56cebf27332352c5c2b5f30c719\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`debit_advice\` DROP FOREIGN KEY \`FK_56cebf27332352c5c2b5f30c719\``);
        await queryRunner.query(`ALTER TABLE \`debit_advice_line\` DROP FOREIGN KEY \`FK_2cada1dad9ead4bfd38020c1043\``);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` CHANGE \`status_id\` \`status_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` ADD CONSTRAINT \`FK_56cebf27332352c5c2b5f30c719\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`debit_advice_line\` CHANGE \`ref_docno\` \`ref_docno\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` DROP COLUMN \`transaction_date\``);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` DROP INDEX \`IDX_ed613f018d6722b7e8b7b33ad3\``);
        await queryRunner.query(`ALTER TABLE \`debit_advice\` DROP COLUMN \`document_number\``);
    }

}
