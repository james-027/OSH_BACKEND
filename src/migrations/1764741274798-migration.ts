import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764741274798 implements MigrationInterface {
    name = 'Migration1764741274798'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`warehouse_requirement_dues\` (\`id\` int NOT NULL AUTO_INCREMENT, \`warehouse_requirement_id\` int NOT NULL, \`warehouse_requirement_due_start\` date NOT NULL, \`warehouse_requirement_due_end\` date NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_wh_req_id_req_dues\` (\`warehouse_requirement_id\`, \`warehouse_requirement_due_start\`, \`warehouse_requirement_due_end\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`warehouse_requirement_starts\` (\`id\` int NOT NULL AUTO_INCREMENT, \`warehouse_requirement_id\` int NOT NULL, \`warehouse_requirement_start\` date NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_wh_req_id_req_start\` (\`warehouse_requirement_id\`, \`warehouse_requirement_start\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`warehouse_requirements\` (\`id\` int NOT NULL AUTO_INCREMENT, \`warehouse_id\` int NOT NULL, \`requirement_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_wh_id_requirement_id\` (\`warehouse_id\`, \`requirement_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` ADD CONSTRAINT \`FK_2df9aef0066001ae8c8891528e7\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` ADD CONSTRAINT \`FK_35a149ed28b2a6e39b0bbbe6035\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` ADD CONSTRAINT \`FK_8361894696d1003bc99f53897c1\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` ADD CONSTRAINT \`FK_9a4d3084c096615be13efd3c948\` FOREIGN KEY (\`warehouse_requirement_id\`) REFERENCES \`warehouse_requirements\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` ADD CONSTRAINT \`FK_6b4c9a06f33bffe0d7a6976fc3a\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` ADD CONSTRAINT \`FK_4d2026aad0040af0e93250b3662\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` ADD CONSTRAINT \`FK_2dde30b20c4be1d5ca57db11689\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` ADD CONSTRAINT \`FK_e520088da7c792dc93118d47e19\` FOREIGN KEY (\`warehouse_requirement_id\`) REFERENCES \`warehouse_requirements\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` ADD CONSTRAINT \`FK_4702d32206b289fd2e378ee631d\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` ADD CONSTRAINT \`FK_2824b6527593b394d9125eb52be\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` ADD CONSTRAINT \`FK_0c863f302d11a7d6a82afa27ae2\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` ADD CONSTRAINT \`FK_bba3d8a1e46092400ff9bdf9f26\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` ADD CONSTRAINT \`FK_329a5e50e2b3184d848fa61e278\` FOREIGN KEY (\`requirement_id\`) REFERENCES \`requirements\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` DROP FOREIGN KEY \`FK_329a5e50e2b3184d848fa61e278\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` DROP FOREIGN KEY \`FK_bba3d8a1e46092400ff9bdf9f26\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` DROP FOREIGN KEY \`FK_0c863f302d11a7d6a82afa27ae2\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` DROP FOREIGN KEY \`FK_2824b6527593b394d9125eb52be\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirements\` DROP FOREIGN KEY \`FK_4702d32206b289fd2e378ee631d\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` DROP FOREIGN KEY \`FK_e520088da7c792dc93118d47e19\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` DROP FOREIGN KEY \`FK_2dde30b20c4be1d5ca57db11689\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` DROP FOREIGN KEY \`FK_4d2026aad0040af0e93250b3662\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_starts\` DROP FOREIGN KEY \`FK_6b4c9a06f33bffe0d7a6976fc3a\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` DROP FOREIGN KEY \`FK_9a4d3084c096615be13efd3c948\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` DROP FOREIGN KEY \`FK_8361894696d1003bc99f53897c1\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` DROP FOREIGN KEY \`FK_35a149ed28b2a6e39b0bbbe6035\``);
        await queryRunner.query(`ALTER TABLE \`warehouse_requirement_dues\` DROP FOREIGN KEY \`FK_2df9aef0066001ae8c8891528e7\``);
        await queryRunner.query(`DROP INDEX \`UQ_wh_id_requirement_id\` ON \`warehouse_requirements\``);
        await queryRunner.query(`DROP TABLE \`warehouse_requirements\``);
        await queryRunner.query(`DROP INDEX \`UQ_wh_req_id_req_start\` ON \`warehouse_requirement_starts\``);
        await queryRunner.query(`DROP TABLE \`warehouse_requirement_starts\``);
        await queryRunner.query(`DROP INDEX \`UQ_wh_req_id_req_dues\` ON \`warehouse_requirement_dues\``);
        await queryRunner.query(`DROP TABLE \`warehouse_requirement_dues\``);
    }

}
