import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditForm1777357232379 implements MigrationInterface {
    name = 'CreateAuditForm1777357232379'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`audit_forms\` (\`id\` int NOT NULL AUTO_INCREMENT, \`audit_form_name\` varchar(255) NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`categories\` (\`id\` int NOT NULL AUTO_INCREMENT, \`category_name\` varchar(255) NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_category_name\` (\`category_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`category_types\` (\`id\` int NOT NULL AUTO_INCREMENT, \`category_type_name\` varchar(255) NOT NULL, \`category_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_category_type_name\` (\`category_type_name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`audit_form_category_types\` (\`id\` int NOT NULL AUTO_INCREMENT, \`audit_form_id\` int NOT NULL, \`category_type_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_by\` int NULL, \`updated_by\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`audit_forms\` ADD CONSTRAINT \`FK_43b1d10f1c3c3e11dc137fb1d34\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_forms\` ADD CONSTRAINT \`FK_8841d355a91ab883672c022de94\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_forms\` ADD CONSTRAINT \`FK_c63ff5cb45c240a9d49676334ec\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`categories\` ADD CONSTRAINT \`FK_9b1d1b9d2ddd657540d54a98524\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`categories\` ADD CONSTRAINT \`FK_23ad9291e0e22cdf46ae7ec5461\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`categories\` ADD CONSTRAINT \`FK_971f81500b65c577edd00dd2687\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`category_types\` ADD CONSTRAINT \`FK_d7a503ed616d13494af372ee803\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`category_types\` ADD CONSTRAINT \`FK_2a7b5ef9c5f0f4074ffbe94e77f\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`category_types\` ADD CONSTRAINT \`FK_4bf0d93b2aa376065154d1aa655\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`category_types\` ADD CONSTRAINT \`FK_b7e18de459b048b1b24011b7d68\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` ADD CONSTRAINT \`FK_b0009ac9bf5f5c6f8c9215c84b8\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` ADD CONSTRAINT \`FK_1619159b7cc41c108c7fef42e98\` FOREIGN KEY (\`category_type_id\`) REFERENCES \`category_types\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` ADD CONSTRAINT \`FK_fb74fc158f5ecab8e046b3417a1\` FOREIGN KEY (\`audit_form_id\`) REFERENCES \`audit_forms\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` ADD CONSTRAINT \`FK_f64963a82827e5fdde7693b48cd\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` ADD CONSTRAINT \`FK_bb342d5ef1d283d529623f5fddc\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` DROP FOREIGN KEY \`FK_bb342d5ef1d283d529623f5fddc\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` DROP FOREIGN KEY \`FK_f64963a82827e5fdde7693b48cd\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` DROP FOREIGN KEY \`FK_fb74fc158f5ecab8e046b3417a1\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` DROP FOREIGN KEY \`FK_1619159b7cc41c108c7fef42e98\``);
        await queryRunner.query(`ALTER TABLE \`audit_form_category_types\` DROP FOREIGN KEY \`FK_b0009ac9bf5f5c6f8c9215c84b8\``);
        await queryRunner.query(`ALTER TABLE \`category_types\` DROP FOREIGN KEY \`FK_b7e18de459b048b1b24011b7d68\``);
        await queryRunner.query(`ALTER TABLE \`category_types\` DROP FOREIGN KEY \`FK_4bf0d93b2aa376065154d1aa655\``);
        await queryRunner.query(`ALTER TABLE \`category_types\` DROP FOREIGN KEY \`FK_2a7b5ef9c5f0f4074ffbe94e77f\``);
        await queryRunner.query(`ALTER TABLE \`category_types\` DROP FOREIGN KEY \`FK_d7a503ed616d13494af372ee803\``);
        await queryRunner.query(`ALTER TABLE \`categories\` DROP FOREIGN KEY \`FK_971f81500b65c577edd00dd2687\``);
        await queryRunner.query(`ALTER TABLE \`categories\` DROP FOREIGN KEY \`FK_23ad9291e0e22cdf46ae7ec5461\``);
        await queryRunner.query(`ALTER TABLE \`categories\` DROP FOREIGN KEY \`FK_9b1d1b9d2ddd657540d54a98524\``);
        await queryRunner.query(`ALTER TABLE \`audit_forms\` DROP FOREIGN KEY \`FK_c63ff5cb45c240a9d49676334ec\``);
        await queryRunner.query(`ALTER TABLE \`audit_forms\` DROP FOREIGN KEY \`FK_8841d355a91ab883672c022de94\``);
        await queryRunner.query(`ALTER TABLE \`audit_forms\` DROP FOREIGN KEY \`FK_43b1d10f1c3c3e11dc137fb1d34\``);
        await queryRunner.query(`DROP TABLE \`audit_form_category_types\``);
        await queryRunner.query(`DROP INDEX \`UQ_category_type_name\` ON \`category_types\``);
        await queryRunner.query(`DROP TABLE \`category_types\``);
        await queryRunner.query(`DROP INDEX \`UQ_category_name\` ON \`categories\``);
        await queryRunner.query(`DROP TABLE \`categories\``);
        await queryRunner.query(`DROP TABLE \`audit_forms\``);
    }

}
