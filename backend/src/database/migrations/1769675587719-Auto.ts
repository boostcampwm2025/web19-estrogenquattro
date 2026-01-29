import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auto1769675587719 implements MigrationInterface {
  name = 'Auto1769675587719';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (0), "is_newbie" boolean NOT NULL DEFAULT (1), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"), CONSTRAINT "FK_279a87ba077e90d4af617c09282" FOREIGN KEY ("equipped_pet_id") REFERENCES "pets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_players"("id", "social_id", "nickname", "equipped_pet_id", "total_point") SELECT "id", "social_id", "nickname", "equipped_pet_id", "total_point" FROM "players"`,
    );
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_players" RENAME TO "players"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "players" RENAME TO "temporary_players"`,
    );
    await queryRunner.query(
      `CREATE TABLE "players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"), CONSTRAINT "FK_279a87ba077e90d4af617c09282" FOREIGN KEY ("equipped_pet_id") REFERENCES "pets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "players"("id", "social_id", "nickname", "equipped_pet_id", "total_point") SELECT "id", "social_id", "nickname", "equipped_pet_id", "total_point" FROM "temporary_players"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_players"`);
  }
}
