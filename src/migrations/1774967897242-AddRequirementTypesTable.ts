import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRequirementTypesTable1774967897242 implements MigrationInterface {
    name = 'AddRequirementTypesTable1774967897242'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`requirement_types\` (\`id\` int NOT NULL AUTO_INCREMENT, \`requirement_type_name\` varchar(255) NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_requirement_type_name\` (\`requirement_type_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD \`requirement_type_id\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`requirement_types\` ADD CONSTRAINT \`FK_ef00f443fb092a19a789a7483bf\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirement_types\` ADD CONSTRAINT \`FK_60f53d0931f9bb8f0497542ac3a\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirement_types\` ADD CONSTRAINT \`FK_07026f04384a6d9d3cbba06a348\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`requirements\` ADD CONSTRAINT \`FK_4b374ec5691eb17772f9ef7bd2f\` FOREIGN KEY (\`requirement_type_id\`) REFERENCES \`requirement_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP FOREIGN KEY \`FK_4b374ec5691eb17772f9ef7bd2f\``);
        await queryRunner.query(`ALTER TABLE \`requirement_types\` DROP FOREIGN KEY \`FK_07026f04384a6d9d3cbba06a348\``);
        await queryRunner.query(`ALTER TABLE \`requirement_types\` DROP FOREIGN KEY \`FK_60f53d0931f9bb8f0497542ac3a\``);
        await queryRunner.query(`ALTER TABLE \`requirement_types\` DROP FOREIGN KEY \`FK_ef00f443fb092a19a789a7483bf\``);
        await queryRunner.query(`ALTER TABLE \`requirements\` DROP COLUMN \`requirement_type_id\``);
        await queryRunner.query(`DROP INDEX \`UQ_requirement_type_name\` ON \`requirement_types\``);
        await queryRunner.query(`DROP TABLE \`requirement_types\``);
    }

}
