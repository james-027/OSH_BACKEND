import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStaffVendorSalariesTable1775000000000 implements MigrationInterface {
    name = 'AddStaffVendorSalariesTable1775000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`staff_vendor_salaries\` (\`id\` int NOT NULL AUTO_INCREMENT, \`staff_id\` int NOT NULL, \`vendor_id\` int NOT NULL, \`location_id\` int NOT NULL, \`allowance\` decimal(10,2) NOT NULL DEFAULT '0.00', \`salary_rate\` decimal(10,2) NOT NULL DEFAULT '0.00', \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_staff_vendor_location\` (\`staff_id\`,\`vendor_id\`,\`location_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_staff_vendor_salaries_status\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_staff_vendor_salaries_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_staff_vendor_salaries_updated_by\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_staff_vendor_salaries_staff\` FOREIGN KEY (\`staff_id\`) REFERENCES \`staff\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_staff_vendor_salaries_vendor\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_staff_vendor_salaries_location\` FOREIGN KEY (\`location_id\`) REFERENCES \`locations\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_staff_vendor_salaries_location\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_staff_vendor_salaries_vendor\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_staff_vendor_salaries_staff\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_staff_vendor_salaries_updated_by\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_staff_vendor_salaries_created_by\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_staff_vendor_salaries_status\``);
        await queryRunner.query(`DROP INDEX \`UQ_staff_vendor_location\` ON \`staff_vendor_salaries\``);
        await queryRunner.query(`DROP TABLE \`staff_vendor_salaries\``);
    }

}
