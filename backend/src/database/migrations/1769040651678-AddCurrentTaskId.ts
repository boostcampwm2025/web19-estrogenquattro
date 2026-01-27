import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentTaskId1769040651678 implements MigrationInterface {
  name = 'AddCurrentTaskId1769040651678';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer, "current_task_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "player_id") SELECT "id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "player_id" FROM "daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_focus_time" RENAME TO "daily_focus_time"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "amount" integer NOT NULL, "created_date" date NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_point"("id", "player_id", "amount", "created_date") SELECT "id", "player_id", "amount", "created_date" FROM "daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_point" RENAME TO "daily_point"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_point" RENAME TO "temporary_daily_point"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "amount" integer NOT NULL, "created_date" date NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_point"("id", "player_id", "amount", "created_date") SELECT "id", "player_id", "amount", "created_date" FROM "temporary_daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "daily_focus_time" RENAME TO "temporary_daily_focus_time"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_focus_time"("id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "player_id") SELECT "id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "player_id" FROM "temporary_daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_focus_time"`);
    await queryRunner.query(`DROP TABLE "daily_point"`);
  }
}
