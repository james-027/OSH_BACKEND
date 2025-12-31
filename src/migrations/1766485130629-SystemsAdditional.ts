import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemsAdditional1766485130629 implements MigrationInterface {
    name = 'SystemsAdditional1766485130629'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`systems\` (\`id\` int NOT NULL AUTO_INCREMENT, \`system_name\` varchar(255) NOT NULL, \`system_abbr\` varchar(50) NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_6ce2ef6fa7cb9d9662692c8bb1\` (\`system_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`system_access_keys\` (\`id\` int NOT NULL AUTO_INCREMENT, \`access_key_id\` int NOT NULL, \`system_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`systems\` ADD CONSTRAINT \`FK_5e03c195557e84e95c8b0ac8e8c\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`systems\` ADD CONSTRAINT \`FK_848b5cf4029ddf43eb14946eb99\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`systems\` ADD CONSTRAINT \`FK_b5a5b11c76b3d8addc4a741ab52\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` ADD CONSTRAINT \`FK_9ad5221e4cac7a29edef38e03ca\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` ADD CONSTRAINT \`FK_6c63647e3fcf3f97f6cb515e06f\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` ADD CONSTRAINT \`FK_865e67c1f0b01bbc813ee970dcc\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` ADD CONSTRAINT \`FK_51d7ad204f0fa82041fef9b44ac\` FOREIGN KEY (\`system_id\`) REFERENCES \`systems\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` ADD CONSTRAINT \`FK_c52a5e5b07cca48681be8cfedbf\` FOREIGN KEY (\`access_key_id\`) REFERENCES \`access_key\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` DROP FOREIGN KEY \`FK_c52a5e5b07cca48681be8cfedbf\``);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` DROP FOREIGN KEY \`FK_51d7ad204f0fa82041fef9b44ac\``);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` DROP FOREIGN KEY \`FK_865e67c1f0b01bbc813ee970dcc\``);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` DROP FOREIGN KEY \`FK_6c63647e3fcf3f97f6cb515e06f\``);
        await queryRunner.query(`ALTER TABLE \`system_access_keys\` DROP FOREIGN KEY \`FK_9ad5221e4cac7a29edef38e03ca\``);
        await queryRunner.query(`ALTER TABLE \`systems\` DROP FOREIGN KEY \`FK_b5a5b11c76b3d8addc4a741ab52\``);
        await queryRunner.query(`ALTER TABLE \`systems\` DROP FOREIGN KEY \`FK_848b5cf4029ddf43eb14946eb99\``);
        await queryRunner.query(`ALTER TABLE \`systems\` DROP FOREIGN KEY \`FK_5e03c195557e84e95c8b0ac8e8c\``);
        await queryRunner.query(`DROP TABLE \`system_access_keys\``);
        await queryRunner.query(`DROP INDEX \`IDX_6ce2ef6fa7cb9d9662692c8bb1\` ON \`systems\``);
        await queryRunner.query(`DROP TABLE \`systems\``);
    }

}
