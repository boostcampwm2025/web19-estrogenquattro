import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeFocusTimeToSeconds1768996643748 implements MigrationInterface {
  name = 'ChangeFocusTimeToSeconds1768996643748';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. daily_focus_time 테이블: total_focus_minutes → total_focus_seconds
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "player_id") SELECT "id", "total_focus_minutes" * 60, "status", "created_date", "last_focus_start_time", "player_id" FROM "daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_focus_time" RENAME TO "daily_focus_time"`,
    );

    // 2. tasks 테이블: total_focus_minutes → total_focus_seconds
    await queryRunner.query(
      `CREATE TABLE "temporary_tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "completed_date" date, "created_date" date NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "player_id" integer, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_tasks"("id", "description", "completed_date", "created_date", "total_focus_seconds", "player_id") SELECT "id", "description", "completed_date", "created_date", "total_focus_minutes" * 60, "player_id" FROM "tasks"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`ALTER TABLE "temporary_tasks" RENAME TO "tasks"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. tasks 테이블 롤백: total_focus_seconds → total_focus_minutes
    await queryRunner.query(
      `CREATE TABLE "temporary_tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "completed_date" date, "created_date" date NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "player_id" integer, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_tasks"("id", "description", "completed_date", "created_date", "total_focus_minutes", "player_id") SELECT "id", "description", "completed_date", "created_date", "total_focus_seconds" / 60, "player_id" FROM "tasks"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`ALTER TABLE "temporary_tasks" RENAME TO "tasks"`);

    // 2. daily_focus_time 테이블 롤백: total_focus_seconds → total_focus_minutes
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_minutes", "status", "created_date", "last_focus_start_time", "player_id") SELECT "id", "total_focus_seconds" / 60, "status", "created_date", "last_focus_start_time", "player_id" FROM "daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_focus_time" RENAME TO "daily_focus_time"`,
    );
  }
}
