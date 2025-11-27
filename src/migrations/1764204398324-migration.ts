import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764204398324 implements MigrationInterface {
    name = 'Migration1764204398324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`reminder_types\` (\`id\` int NOT NULL AUTO_INCREMENT, \`reminder_type_name\` varchar(255) NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_reminder_type_name\` (\`reminder_type_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`reminder_types\` ADD CONSTRAINT \`FK_a711da34da0c4ecfccc40724c6d\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`reminder_types\` ADD CONSTRAINT \`FK_6657efb3b6b15ba8eabc195394b\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`reminder_types\` ADD CONSTRAINT \`FK_506adee80675e2ba7bc6d7c82af\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`reminder_types\` DROP FOREIGN KEY \`FK_506adee80675e2ba7bc6d7c82af\``);
        await queryRunner.query(`ALTER TABLE \`reminder_types\` DROP FOREIGN KEY \`FK_6657efb3b6b15ba8eabc195394b\``);
        await queryRunner.query(`ALTER TABLE \`reminder_types\` DROP FOREIGN KEY \`FK_a711da34da0c4ecfccc40724c6d\``);
        await queryRunner.query(`DROP INDEX \`UQ_reminder_type_name\` ON \`reminder_types\``);
        await queryRunner.query(`DROP TABLE \`reminder_types\``);
    }

}
