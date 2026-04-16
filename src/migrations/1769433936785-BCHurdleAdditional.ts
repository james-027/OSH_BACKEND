import { MigrationInterface, QueryRunner } from "typeorm";

export class BCHurdleAdditional1769433936785 implements MigrationInterface {
    name = 'BCHurdleAdditional1769433936785'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`location_hurdles\` (\`id\` int NOT NULL AUTO_INCREMENT, \`location_id\` int NOT NULL, \`location_rate\` decimal(10,2) NOT NULL DEFAULT '0.00', \`ss_hurdle_qty\` int NOT NULL, \`hurdle_date\` date NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` int NULL, \`updated_by\` int NULL, \`undo_reason\` text NULL, UNIQUE INDEX \`IDX_b38797ec19bf642c307b9f13fa\` (\`location_id\`, \`hurdle_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`location_hurdle_categories\` (\`id\` int NOT NULL AUTO_INCREMENT, \`location_id\` int NOT NULL, \`item_category_id\` int NOT NULL, \`status_id\` int NOT NULL DEFAULT '1', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`created_by\` int NULL, \`modified_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`updated_by\` int NULL, \`location_hurdle_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` ADD CONSTRAINT \`FK_598d2d9af3d249aa76d41531b29\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` ADD CONSTRAINT \`FK_5b37102f90f86c1103333a19362\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` ADD CONSTRAINT \`FK_752f851a13f63299b72c09aa052\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` ADD CONSTRAINT \`FK_ce099580ad579b76cdfd5205b38\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` ADD CONSTRAINT \`FK_f69c383e5a29a01134c271ef9dd\` FOREIGN KEY (\`location_id\`) REFERENCES \`location\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` ADD CONSTRAINT \`FK_62cc4697cf3572b8b5378a7e963\` FOREIGN KEY (\`item_category_id\`) REFERENCES \`item_category\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` ADD CONSTRAINT \`FK_bd81bae06706daa4008425d163a\` FOREIGN KEY (\`status_id\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` ADD CONSTRAINT \`FK_1ee7c3dbe906397f793c61e648a\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` ADD CONSTRAINT \`FK_0929c9c9e40bfbef0feab34ff4a\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` ADD CONSTRAINT \`FK_0a55c037876a1fd22de3d2bdfa4\` FOREIGN KEY (\`location_hurdle_id\`) REFERENCES \`location_hurdles\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` DROP FOREIGN KEY \`FK_0a55c037876a1fd22de3d2bdfa4\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` DROP FOREIGN KEY \`FK_0929c9c9e40bfbef0feab34ff4a\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` DROP FOREIGN KEY \`FK_1ee7c3dbe906397f793c61e648a\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` DROP FOREIGN KEY \`FK_bd81bae06706daa4008425d163a\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` DROP FOREIGN KEY \`FK_62cc4697cf3572b8b5378a7e963\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdle_categories\` DROP FOREIGN KEY \`FK_f69c383e5a29a01134c271ef9dd\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` DROP FOREIGN KEY \`FK_ce099580ad579b76cdfd5205b38\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` DROP FOREIGN KEY \`FK_752f851a13f63299b72c09aa052\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` DROP FOREIGN KEY \`FK_5b37102f90f86c1103333a19362\``);
        await queryRunner.query(`ALTER TABLE \`location_hurdles\` DROP FOREIGN KEY \`FK_598d2d9af3d249aa76d41531b29\``);
        await queryRunner.query(`DROP TABLE \`location_hurdle_categories\``);
        await queryRunner.query(`DROP INDEX \`IDX_b38797ec19bf642c307b9f13fa\` ON \`location_hurdles\``);
        await queryRunner.query(`DROP TABLE \`location_hurdles\``);
    }

}
