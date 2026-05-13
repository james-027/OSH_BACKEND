import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCMSMigration1778196958440 implements MigrationInterface {
    name = 'CreateCMSMigration1778196958440'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`vendors\` (\`id\` int NOT NULL AUTO_INCREMENT, \`service_provider_name\` varchar(255) NOT NULL, \`service_provider_code\` varchar(255) NOT NULL, \`category_id\` int NOT NULL, \`tax\` decimal(10,2) NULL, \`vat\` decimal(10,2) NULL, \`asf\` decimal(10,2) NULL, \`erp_id\` int NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_service_provider_code\` (\`service_provider_code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`staffs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`staff_code\` varchar(255) NULL, \`last_name\` varchar(255) NOT NULL, \`first_name\` varchar(255) NOT NULL, \`middle_name\` varchar(255) NULL, \`location_id\` int NOT NULL, \`vendor_id\` int NOT NULL, \`assign_status_id\` int NOT NULL, \`position_id\` int NOT NULL, \`sss_number\` varchar(255) NULL, \`pagibig_number\` varchar(255) NULL, \`tin\` varchar(255) NULL, \`remarks\` text NULL, \`hired_date\` date NULL, \`to_hr_date\` date NULL, \`to_sts_date\` date NULL, \`approved_eprf_date\` date NULL, \`req_completion_date\` date NULL, \`actual_deployment_date\` date NULL, \`separated_date\` date NULL, \`birthday\` date NULL, \`contact_number\` int NULL, \`overall_remarks\` text NULL, \`store_request\` text NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`staff_vendor_salaries\` (\`id\` int NOT NULL AUTO_INCREMENT, \`staff_id\` int NOT NULL, \`vendor_id\` int NOT NULL, \`location_id\` int NOT NULL, \`allowance\` decimal(10,2) NOT NULL DEFAULT '0.00', \`salary_rate\` decimal(10,2) NOT NULL DEFAULT '0.00', \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`staff_brands\` (\`id\` int NOT NULL AUTO_INCREMENT, \`staff_id\` int NOT NULL, \`brand_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`staff_category_types\` (\`id\` int NOT NULL AUTO_INCREMENT, \`staff_id\` int NOT NULL, \`category_type_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`staff_warehouses\` (\`id\` int NOT NULL AUTO_INCREMENT, \`staff_id\` int NOT NULL, \`staff_code\` varchar(255) NOT NULL, \`warehouse_id\` int NOT NULL, \`location_id\` int NOT NULL, \`vendor_id\` int NOT NULL, \`effectivity_date\` date NULL, \`end_date\` date NULL, \`remarks\` text NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`vendors\` ADD CONSTRAINT \`FK_d65c26bec3a226d26a5d75897cb\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`vendors\` ADD CONSTRAINT \`FK_592e90dc8526c1d9bf359581058\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`vendors\` ADD CONSTRAINT \`FK_9743b3c7cea56b595f16ebc369c\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`vendors\` ADD CONSTRAINT \`FK_70bf112f39f9e1469a1af5eaf01\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD CONSTRAINT \`FK_8d8109b5e9de3060cf4584483af\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD CONSTRAINT \`FK_52baa9ea18b7244490cd8c995e5\` FOREIGN KEY (\`assign_status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD CONSTRAINT \`FK_4fd41423e2c5bfa6735cb868a02\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD CONSTRAINT \`FK_4a1b73db0e4ea65788775372121\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD CONSTRAINT \`FK_4a3b1b599631ab03ce819eace1e\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD CONSTRAINT \`FK_22664912c8a47fef489dc2a80e6\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staffs\` ADD CONSTRAINT \`FK_3a91e6f8ccf5412830b25b0d6c4\` FOREIGN KEY (\`position_id\`) REFERENCES \`positions\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_f32256a576439e15ab3958bca0f\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_e39547e9e859dfb48b8299f1988\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_ed15cad92abe230fbb449eaa580\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_eb20ebfe58cec0c79b17ab8e25f\` FOREIGN KEY (\`staff_id\`) REFERENCES \`staffs\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_5da1bd42f16d44130c762c61aaf\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` ADD CONSTRAINT \`FK_825b545ab420a0bd89fc342f1dc\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` ADD CONSTRAINT \`FK_acd8753de72c412405dc3a83260\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` ADD CONSTRAINT \`FK_817766564fa6cef8eb385d7ec0e\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` ADD CONSTRAINT \`FK_e548ebe498a5c15ad8c3c8ce28d\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` ADD CONSTRAINT \`FK_c2fc681330dbe2b1776b1be6c0c\` FOREIGN KEY (\`staff_id\`) REFERENCES \`staffs\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` ADD CONSTRAINT \`FK_4f4022c029703cf5dddb0c1e868\` FOREIGN KEY (\`brand_id\`) REFERENCES \`brands\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` ADD CONSTRAINT \`FK_eabaaf3ae14ae1335e99c2b57bf\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` ADD CONSTRAINT \`FK_c9355b89a8d1b45640531221f01\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` ADD CONSTRAINT \`FK_3507b437f6032bf3cd926e995f7\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` ADD CONSTRAINT \`FK_929d2c875df8c0fc982cf6e8b63\` FOREIGN KEY (\`staff_id\`) REFERENCES \`staffs\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` ADD CONSTRAINT \`FK_2f72570b3ad99d61cb668776830\` FOREIGN KEY (\`category_type_id\`) REFERENCES \`category_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` ADD CONSTRAINT \`FK_d286cea9e4f7f089b6023bcd2c7\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` ADD CONSTRAINT \`FK_3d97d0d92d1192a3ecf7bbe70aa\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` ADD CONSTRAINT \`FK_811913d719bd16e823cb4187fc5\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` ADD CONSTRAINT \`FK_0cfe7f7f2ff54cf614b2cedbad0\` FOREIGN KEY (\`staff_id\`) REFERENCES \`staffs\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` ADD CONSTRAINT \`FK_54082f42ade489c5c9975b1f9be\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` ADD CONSTRAINT \`FK_d1c10e48062e38aaaef7f621809\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` ADD CONSTRAINT \`FK_f9f4cd2f08fc4a2502a69b48bd9\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` DROP FOREIGN KEY \`FK_f9f4cd2f08fc4a2502a69b48bd9\``);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` DROP FOREIGN KEY \`FK_d1c10e48062e38aaaef7f621809\``);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` DROP FOREIGN KEY \`FK_54082f42ade489c5c9975b1f9be\``);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` DROP FOREIGN KEY \`FK_0cfe7f7f2ff54cf614b2cedbad0\``);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` DROP FOREIGN KEY \`FK_811913d719bd16e823cb4187fc5\``);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` DROP FOREIGN KEY \`FK_3d97d0d92d1192a3ecf7bbe70aa\``);
        await queryRunner.query(`ALTER TABLE \`staff_warehouses\` DROP FOREIGN KEY \`FK_d286cea9e4f7f089b6023bcd2c7\``);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` DROP FOREIGN KEY \`FK_2f72570b3ad99d61cb668776830\``);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` DROP FOREIGN KEY \`FK_929d2c875df8c0fc982cf6e8b63\``);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` DROP FOREIGN KEY \`FK_3507b437f6032bf3cd926e995f7\``);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` DROP FOREIGN KEY \`FK_c9355b89a8d1b45640531221f01\``);
        await queryRunner.query(`ALTER TABLE \`staff_category_types\` DROP FOREIGN KEY \`FK_eabaaf3ae14ae1335e99c2b57bf\``);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` DROP FOREIGN KEY \`FK_4f4022c029703cf5dddb0c1e868\``);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` DROP FOREIGN KEY \`FK_c2fc681330dbe2b1776b1be6c0c\``);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` DROP FOREIGN KEY \`FK_e548ebe498a5c15ad8c3c8ce28d\``);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` DROP FOREIGN KEY \`FK_817766564fa6cef8eb385d7ec0e\``);
        await queryRunner.query(`ALTER TABLE \`staff_brands\` DROP FOREIGN KEY \`FK_acd8753de72c412405dc3a83260\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_825b545ab420a0bd89fc342f1dc\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_5da1bd42f16d44130c762c61aaf\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_eb20ebfe58cec0c79b17ab8e25f\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_ed15cad92abe230fbb449eaa580\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_e39547e9e859dfb48b8299f1988\``);
        await queryRunner.query(`ALTER TABLE \`staff_vendor_salaries\` DROP FOREIGN KEY \`FK_f32256a576439e15ab3958bca0f\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP FOREIGN KEY \`FK_3a91e6f8ccf5412830b25b0d6c4\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP FOREIGN KEY \`FK_22664912c8a47fef489dc2a80e6\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP FOREIGN KEY \`FK_4a3b1b599631ab03ce819eace1e\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP FOREIGN KEY \`FK_4a1b73db0e4ea65788775372121\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP FOREIGN KEY \`FK_4fd41423e2c5bfa6735cb868a02\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP FOREIGN KEY \`FK_52baa9ea18b7244490cd8c995e5\``);
        await queryRunner.query(`ALTER TABLE \`staffs\` DROP FOREIGN KEY \`FK_8d8109b5e9de3060cf4584483af\``);
        await queryRunner.query(`ALTER TABLE \`vendors\` DROP FOREIGN KEY \`FK_70bf112f39f9e1469a1af5eaf01\``);
        await queryRunner.query(`ALTER TABLE \`vendors\` DROP FOREIGN KEY \`FK_9743b3c7cea56b595f16ebc369c\``);
        await queryRunner.query(`ALTER TABLE \`vendors\` DROP FOREIGN KEY \`FK_592e90dc8526c1d9bf359581058\``);
        await queryRunner.query(`ALTER TABLE \`vendors\` DROP FOREIGN KEY \`FK_d65c26bec3a226d26a5d75897cb\``);
    }

}
