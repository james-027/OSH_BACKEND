import { MigrationInterface, QueryRunner } from "typeorm";

export class CheckStaleMigration1783415750291 implements MigrationInterface {
  name = "CheckStaleMigration1783415750291";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, add the columns as nullable initially
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD \`group_name\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD \`group_code\` varchar(255) NOT NULL`,
    );
    // await queryRunner.query(
    //   `ALTER TABLE \`suppliers\` ADD UNIQUE INDEX \`IDX_5835a78ae48362a125e82475a7\` (\`group_code\`)`,
    // );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD \`taxid\` varchar(255) NOT NULL`,
    );

    // Add company column as nullable first
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD \`company\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profitcenters\` ADD \`company\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profitcenters\` ADD \`business_center\` varchar(255) NULL`,
    );

    // Update existing suppliers with default company
    await queryRunner.query(`
        UPDATE \`suppliers\` SET \`company\` = 'CTGI' WHERE \`company\` IS NULL
    `);

    // Update existing profitcenters with default company
    await queryRunner.query(`
        UPDATE \`profitcenters\` SET \`company\` = 'CTGI' WHERE \`company\` IS NULL
    `);

    // Now make the column NOT NULL
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` MODIFY \`company\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profitcenters\` MODIFY \`company\` varchar(255) NOT NULL`,
    );

    // Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` ADD CONSTRAINT \`FK_3355b063e039ed81307201425ca\` FOREIGN KEY (\`company\`) REFERENCES \`company\`(\`company_abbr\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profitcenters\` ADD CONSTRAINT \`FK_2f782b481e2a215b720a48295ee\` FOREIGN KEY (\`company\`) REFERENCES \`company\`(\`company_abbr\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`gl_accounts\` ADD CONSTRAINT \`FK_86b619798f804ac4d66bbdf41a0\` FOREIGN KEY (\`company\`) REFERENCES \`company\`(\`company_abbr\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`gl_accounts\` DROP FOREIGN KEY \`FK_86b619798f804ac4d66bbdf41a0\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profitcenters\` DROP FOREIGN KEY \`FK_2f782b481e2a215b720a48295ee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP FOREIGN KEY \`FK_3355b063e039ed81307201425ca\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profitcenters\` DROP COLUMN \`business_center\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profitcenters\` DROP COLUMN \`company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP COLUMN \`company\``,
    );
    await queryRunner.query(`ALTER TABLE \`suppliers\` DROP COLUMN \`taxid\``);
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP INDEX \`IDX_5835a78ae48362a125e82475a7\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP COLUMN \`group_code\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`suppliers\` DROP COLUMN \`group_name\``,
    );
  }
}
