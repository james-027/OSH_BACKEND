import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFKAuditFormDetails1777964784701 implements MigrationInterface {
  name = "AddFKAuditFormDetails1777964784701";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_month\` \`audit_month\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_date\` \`audit_date\` date NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_crew_name\` \`store_crew_name\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_crew_code\` \`store_crew_code\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`agency\` \`agency\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`food_safety_score\` \`food_safety_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`work_instruction_score\` \`work_instruction_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`product_quality_score\` \`product_quality_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`ssop_score\` \`ssop_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_final_score\` \`audit_final_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`computed_at\` \`computed_at\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_id\` \`store_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_specialist_id\` \`store_specialist_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`area_head_id\` \`area_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`group_area_head_id\` \`group_area_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`location_id\` \`location_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`group_business_center_head_id\` \`group_business_center_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`regional_head_id\` \`regional_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_form_id\` \`audit_form_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`created_by\` \`created_by\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`updated_by\` \`updated_by\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_form_details_id\` \`audit_form_details_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_reference_id\` \`audit_reference_id\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_month\` \`audit_month\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_date\` \`audit_date\` date NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_crew_name\` \`store_crew_name\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_crew_code\` \`store_crew_code\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`agency\` \`agency\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`food_safety_score\` \`food_safety_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`work_instruction_score\` \`work_instruction_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`product_quality_score\` \`product_quality_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`ssop_score\` \`ssop_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_final_score\` \`audit_final_score\` decimal NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`computed_at\` \`computed_at\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_id\` \`store_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_specialist_id\` \`store_specialist_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`area_head_id\` \`area_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`group_area_head_id\` \`group_area_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`location_id\` \`location_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`group_business_center_head_id\` \`group_business_center_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`regional_head_id\` \`regional_head_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_form_id\` \`audit_form_id\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`created_by\` \`created_by\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`updated_by\` \`updated_by\` int NULL`,
    );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_a9807d2d36493e284e04e045528\` FOREIGN KEY (\`store_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_be3f8662e612566ed87b568a42c\` FOREIGN KEY (\`store_specialist_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_026c4f5d35c538408d961f8bd77\` FOREIGN KEY (\`area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_96c968d70fb8db69bf93581cb16\` FOREIGN KEY (\`group_area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_12693835a430b864c48b0409ca7\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_c73ae480c36cc667dabb394bc7b\` FOREIGN KEY (\`group_business_center_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_2a994187d6c8475fa741100d1b9\` FOREIGN KEY (\`regional_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_ae715b87fceb2875d8c7e2d1e74\` FOREIGN KEY (\`audit_form_id\`) REFERENCES \`audit_forms\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_ac584e0b4e5a4682ab3b365788b\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details\` ADD CONSTRAINT \`FK_d1a5a44a59b2b765de5292a5502\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_1f363810acd0a0f3f7c59793961\` FOREIGN KEY (\`audit_form_details_id\`) REFERENCES \`audit_form_details\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_dda1bfa5b82e3315e2f55928ade\` FOREIGN KEY (\`store_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_44247a619ff831936456296058c\` FOREIGN KEY (\`store_specialist_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_799b91545a0d1370f234663e509\` FOREIGN KEY (\`area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_04d428dfc49bd7c6a725461862c\` FOREIGN KEY (\`group_area_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_2c037598b90bc038adf8b5f067d\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_abaa16f2415997e54ba1d0ac88b\` FOREIGN KEY (\`group_business_center_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_12fcac6f655b7c0951b75584200\` FOREIGN KEY (\`regional_head_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_6ecdf592237aef9ebb2e2098431\` FOREIGN KEY (\`audit_form_id\`) REFERENCES \`audit_forms\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_85ab716af4e9d351b81adf11bdd\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE \`audit_form_details_history\` ADD CONSTRAINT \`FK_7c5098a2f74dda2d2b24d1a39da\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_7c5098a2f74dda2d2b24d1a39da\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_85ab716af4e9d351b81adf11bdd\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_6ecdf592237aef9ebb2e2098431\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_12fcac6f655b7c0951b75584200\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_abaa16f2415997e54ba1d0ac88b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_2c037598b90bc038adf8b5f067d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_04d428dfc49bd7c6a725461862c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_799b91545a0d1370f234663e509\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_44247a619ff831936456296058c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_dda1bfa5b82e3315e2f55928ade\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` DROP FOREIGN KEY \`FK_1f363810acd0a0f3f7c59793961\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_d1a5a44a59b2b765de5292a5502\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_ac584e0b4e5a4682ab3b365788b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_ae715b87fceb2875d8c7e2d1e74\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_2a994187d6c8475fa741100d1b9\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_c73ae480c36cc667dabb394bc7b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_12693835a430b864c48b0409ca7\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_96c968d70fb8db69bf93581cb16\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_026c4f5d35c538408d961f8bd77\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_be3f8662e612566ed87b568a42c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` DROP FOREIGN KEY \`FK_a9807d2d36493e284e04e045528\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`updated_by\` \`updated_by\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`created_by\` \`created_by\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_form_id\` \`audit_form_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`regional_head_id\` \`regional_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`group_business_center_head_id\` \`group_business_center_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`location_id\` \`location_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`group_area_head_id\` \`group_area_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`area_head_id\` \`area_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_specialist_id\` \`store_specialist_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_id\` \`store_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`computed_at\` \`computed_at\` timestamp NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_final_score\` \`audit_final_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`ssop_score\` \`ssop_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`product_quality_score\` \`product_quality_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`work_instruction_score\` \`work_instruction_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`food_safety_score\` \`food_safety_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`agency\` \`agency\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_crew_code\` \`store_crew_code\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`store_crew_name\` \`store_crew_name\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_date\` \`audit_date\` date NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_month\` \`audit_month\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_reference_id\` \`audit_reference_id\` varchar(100) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details_history\` CHANGE \`audit_form_details_id\` \`audit_form_details_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`updated_by\` \`updated_by\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`created_by\` \`created_by\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_form_id\` \`audit_form_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`regional_head_id\` \`regional_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`group_business_center_head_id\` \`group_business_center_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`location_id\` \`location_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`group_area_head_id\` \`group_area_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`area_head_id\` \`area_head_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_specialist_id\` \`store_specialist_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_id\` \`store_id\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`computed_at\` \`computed_at\` timestamp NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_final_score\` \`audit_final_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`ssop_score\` \`ssop_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`product_quality_score\` \`product_quality_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`work_instruction_score\` \`work_instruction_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`food_safety_score\` \`food_safety_score\` decimal(10,0) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`agency\` \`agency\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_crew_code\` \`store_crew_code\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`store_crew_name\` \`store_crew_name\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_date\` \`audit_date\` date NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_form_details\` CHANGE \`audit_month\` \`audit_month\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_7c5098a2f74dda2d2b24d1a39da\` ON \`audit_form_details_history\` (\`updated_by\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_85ab716af4e9d351b81adf11bdd\` ON \`audit_form_details_history\` (\`created_by\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_6ecdf592237aef9ebb2e2098431\` ON \`audit_form_details_history\` (\`audit_form_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_12fcac6f655b7c0951b75584200\` ON \`audit_form_details_history\` (\`regional_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_abaa16f2415997e54ba1d0ac88b\` ON \`audit_form_details_history\` (\`group_business_center_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_2c037598b90bc038adf8b5f067d\` ON \`audit_form_details_history\` (\`location_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_04d428dfc49bd7c6a725461862c\` ON \`audit_form_details_history\` (\`group_area_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_799b91545a0d1370f234663e509\` ON \`audit_form_details_history\` (\`area_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_44247a619ff831936456296058c\` ON \`audit_form_details_history\` (\`store_specialist_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_dda1bfa5b82e3315e2f55928ade\` ON \`audit_form_details_history\` (\`store_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_1f363810acd0a0f3f7c59793961\` ON \`audit_form_details_history\` (\`audit_form_details_id\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_cceca0d6af7bde2ac91c994eb2\` ON \`audit_form_details_history\` (\`audit_reference_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_d1a5a44a59b2b765de5292a5502\` ON \`audit_form_details\` (\`updated_by\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_ac584e0b4e5a4682ab3b365788b\` ON \`audit_form_details\` (\`created_by\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_ae715b87fceb2875d8c7e2d1e74\` ON \`audit_form_details\` (\`audit_form_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_2a994187d6c8475fa741100d1b9\` ON \`audit_form_details\` (\`regional_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_c73ae480c36cc667dabb394bc7b\` ON \`audit_form_details\` (\`group_business_center_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_12693835a430b864c48b0409ca7\` ON \`audit_form_details\` (\`location_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_96c968d70fb8db69bf93581cb16\` ON \`audit_form_details\` (\`group_area_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_026c4f5d35c538408d961f8bd77\` ON \`audit_form_details\` (\`area_head_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_be3f8662e612566ed87b568a42c\` ON \`audit_form_details\` (\`store_specialist_id\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`FK_a9807d2d36493e284e04e045528\` ON \`audit_form_details\` (\`store_id\`)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_f7f90a1b491d40a270f947c291\` ON \`audit_form_details\` (\`audit_reference_id\`)`,
    );
  }
}
