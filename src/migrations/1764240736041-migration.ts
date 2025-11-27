import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764240736041 implements MigrationInterface {
    name = 'Migration1764240736041'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`renewal_types\` (\`id\` int NOT NULL AUTO_INCREMENT, \`renewal_type_name\` varchar(255) NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_renewal_type_name\` (\`renewal_type_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`renewal_types\` ADD CONSTRAINT \`FK_4ecd11c3be530ec163e1717bcb6\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`renewal_types\` ADD CONSTRAINT \`FK_d1f88515b3f2f55692ad860bb3a\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`renewal_types\` ADD CONSTRAINT \`FK_96c83faa443ed4b4207287ead32\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`renewal_types\` DROP FOREIGN KEY \`FK_96c83faa443ed4b4207287ead32\``);
        await queryRunner.query(`ALTER TABLE \`renewal_types\` DROP FOREIGN KEY \`FK_d1f88515b3f2f55692ad860bb3a\``);
        await queryRunner.query(`ALTER TABLE \`renewal_types\` DROP FOREIGN KEY \`FK_4ecd11c3be530ec163e1717bcb6\``);
        await queryRunner.query(`DROP INDEX \`UQ_renewal_type_name\` ON \`renewal_types\``);
        await queryRunner.query(`DROP TABLE \`renewal_types\``);
    }

}
