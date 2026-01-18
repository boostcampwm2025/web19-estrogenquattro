import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFocusTimeFields1768743865938 implements MigrationInterface {
  name = 'AddFocusTimeFields1768743865938';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );

    await queryRunner.query(
      `CREATE TABLE "temporary_tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "description" varchar(100) NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "completed_date" date, "created_date" date NOT NULL, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_tasks"("id", "player_id", "description", "total_focus_minutes", "completed_date", "created_date") SELECT "id", "player_id", COALESCE("description", ''), "duration_minutes", "completed_date", "created_date" FROM "tasks"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`ALTER TABLE "temporary_tasks" RENAME TO "tasks"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" RENAME TO "temporary_tasks"`);
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" bigint, "description" varchar(100), "duration_minutes" integer NOT NULL DEFAULT (0), "completed_date" date NOT NULL, "created_date" date NOT NULL)`,
    );
    await queryRunner.query(
      `INSERT INTO "tasks"("id", "player_id", "description", "duration_minutes", "completed_date", "created_date") SELECT "id", "player_id", "description", "total_focus_minutes", COALESCE("completed_date", "created_date"), "created_date" FROM "temporary_tasks"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_tasks"`);

    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
  }
}
