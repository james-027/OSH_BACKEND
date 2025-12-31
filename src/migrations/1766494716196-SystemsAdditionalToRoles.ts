import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemsAdditionalToRoles1766494716196 implements MigrationInterface {
    name = 'SystemsAdditionalToRoles1766494716196'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`role\` ADD \`system_id\` int NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE \`role\` ADD CONSTRAINT \`FK_f493c8e029d873f6becc8f429c4\` FOREIGN KEY (\`system_id\`) REFERENCES \`systems\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`role\` DROP FOREIGN KEY \`FK_f493c8e029d873f6becc8f429c4\``);
        await queryRunner.query(`ALTER TABLE \`role\` DROP COLUMN \`system_id\``);
    }

}
