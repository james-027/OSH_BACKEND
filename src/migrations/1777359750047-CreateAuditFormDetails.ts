import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditFormDetails1777359750047 implements MigrationInterface {
    name = 'CreateAuditFormDetails1777359750047'

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`CREATE TABLE \`audit_form_details\` (\`id\` int NOT NULL AUTO_INCREMENT, \`audit_reference_id\` int NULL, \`audit_month\` varchar(255) NULL, \`audit_date\` date NULL, \`store_crew_name\` varchar(255) NULL, \`store_crew_code\` varchar(255) NULL, \`agency\` varchar(255) NULL, \`food_safety_score\` decimal NULL, \`work_instruction_score\` decimal NULL, \`product_quality_score\` decimal NULL, \`ssop_score\` decimal NULL, \`audit_final_score\` decimal NULL, \`computed_at\` timestamp NULL, \`store_id\` int NULL, \`store_specialist_id\` int NULL, \`area_head_id\` int NULL, \`group_area_head_id\` int NULL, \`location_id\` int NULL, \`group_business_center_head_id\` int NULL, \`regional_head_id\` int NULL, \`category_type_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`audit_form_id\` int NULL, \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`audit_form_details_history\` (\`id\` int NOT NULL AUTO_INCREMENT, \`audit_form_details_id\` int NULL, \`audit_reference_id\` int NULL, \`audit_month\` varchar(255) NULL, \`audit_date\` date NULL, \`store_crew_name\` varchar(255) NULL, \`store_crew_code\` varchar(255) NULL, \`agency\` varchar(255) NULL, \`food_safety_score\` decimal NULL, \`work_instruction_score\` decimal NULL, \`product_quality_score\` decimal NULL, \`ssop_score\` decimal NULL, \`audit_final_score\` decimal NULL, \`computed_at\` timestamp NULL, \`store_id\` int NULL, \`store_specialist_id\` int NULL, \`area_head_id\` int NULL, \`group_area_head_id\` int NULL, \`location_id\` int NULL, \`group_business_center_head_id\` int NULL, \`regional_head_id\` int NULL, \`category_type_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`audit_form_id\` int NULL, \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_a9807d2d36493e284e04e045528\` FOREIGN KEY (\`store_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_be3f8662e612566ed87b568a42c\` FOREIGN KEY (\`store_specialist_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_026c4f5d35c538408d961f8bd77\` FOREIGN KEY (\`area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_96c968d70fb8db69bf93581cb16\` FOREIGN KEY (\`group_area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_12693835a430b864c48b0409ca7\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_c73ae480c36cc667dabb394bc7b\` FOREIGN KEY (\`group_business_center_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_2a994187d6c8475fa741100d1b9\` FOREIGN KEY (\`regional_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_e9a978af5e7fdf20ed63a77ba78\` FOREIGN KEY (\`category_type_id\`) REFERENCES \`category_types\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_ce3538f12c6398ff1f377ab59fb\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_ae715b87fceb2875d8c7e2d1e74\` FOREIGN KEY (\`audit_form_id\`) REFERENCES \`audit_forms\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_ac584e0b4e5a4682ab3b365788b\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_d1a5a44a59b2b765de5292a5502\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_1f363810acd0a0f3f7c59793961\` FOREIGN KEY (\`audit_form_details_id\`) REFERENCES \`audit_form_details\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_dda1bfa5b82e3315e2f55928ade\` FOREIGN KEY (\`store_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_44247a619ff831936456296058c\` FOREIGN KEY (\`store_specialist_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_799b91545a0d1370f234663e509\` FOREIGN KEY (\`area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_04d428dfc49bd7c6a725461862c\` FOREIGN KEY (\`group_area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_2c037598b90bc038adf8b5f067d\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_abaa16f2415997e54ba1d0ac88b\` FOREIGN KEY (\`group_business_center_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_12fcac6f655b7c0951b75584200\` FOREIGN KEY (\`regional_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_44a3082fccec17db2a3b41fa355\` FOREIGN KEY (\`category_type_id\`) REFERENCES \`category_types\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_dec717a946f590a2e7cbb5851a8\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_6ecdf592237aef9ebb2e2098431\` FOREIGN KEY (\`audit_form_id\`) REFERENCES \`audit_forms\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_85ab716af4e9d351b81adf11bdd\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_7c5098a2f74dda2d2b24d1a39da\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_7c5098a2f74dda2d2b24d1a39da\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_85ab716af4e9d351b81adf11bdd\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_6ecdf592237aef9ebb2e2098431\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_dec717a946f590a2e7cbb5851a8\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_44a3082fccec17db2a3b41fa355\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_12fcac6f655b7c0951b75584200\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_abaa16f2415997e54ba1d0ac88b\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_2c037598b90bc038adf8b5f067d\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_04d428dfc49bd7c6a725461862c\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_799b91545a0d1370f234663e509\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_44247a619ff831936456296058c\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_dda1bfa5b82e3315e2f55928ade\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_1f363810acd0a0f3f7c59793961\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_d1a5a44a59b2b765de5292a5502\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_ac584e0b4e5a4682ab3b365788b\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_ae715b87fceb2875d8c7e2d1e74\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_ce3538f12c6398ff1f377ab59fb\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_e9a978af5e7fdf20ed63a77ba78\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_2a994187d6c8475fa741100d1b9\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_c73ae480c36cc667dabb394bc7b\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_12693835a430b864c48b0409ca7\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_96c968d70fb8db69bf93581cb16\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_026c4f5d35c538408d961f8bd77\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_be3f8662e612566ed87b568a42c\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_a9807d2d36493e284e04e045528\``);
        await queryRunner.query(`DROP TABLE \`audit_form_details_history\``);
        await queryRunner.query(`DROP TABLE \`audit_form_details\``);
    
    }

}
