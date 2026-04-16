import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActionLevel1773557075967 implements MigrationInterface {
    name = 'AddActionLevel1773557075967'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action\` ADD \`action_level\` int NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`action\` DROP COLUMN \`action_level\``);
    }

}
