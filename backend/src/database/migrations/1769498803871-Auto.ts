import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auto1769498803871 implements MigrationInterface {
  name = 'Auto1769498803871';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "created_at" text NOT NULL DEFAULT (datetime('now')), "player_id" integer, CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_point_history"("id", "type", "amount", "created_at", "player_id") SELECT "id", "type", "amount", "created_at", "player_id" FROM "point_history"`,
    );
    await queryRunner.query(`DROP TABLE "point_history"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_point_history" RENAME TO "point_history"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_date" text NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_point"("id", "player_id", "amount", "created_date") SELECT "id", "player_id", "amount", "created_date" FROM "daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_point" RENAME TO "daily_point"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_at" text NOT NULL, "last_focus_start_time" datetime, "current_task_id" integer, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5e0d8534eec1ca1de41d315cca8" FOREIGN KEY ("current_task_id") REFERENCES "tasks" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_seconds", "status", "created_at", "last_focus_start_time", "current_task_id", "player_id") SELECT "id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "current_task_id", "player_id" FROM "daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_focus_time" RENAME TO "daily_focus_time"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" text NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_github_activity"("id", "type", "count", "created_date", "player_id") SELECT "id", "type", "count", "created_date", "player_id" FROM "daily_github_activity"`,
    );
    await queryRunner.query(`DROP TABLE "daily_github_activity"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "player_id" integer, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_tasks"("id", "description", "total_focus_seconds", "player_id") SELECT "id", "description", "total_focus_seconds", "player_id" FROM "tasks"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`ALTER TABLE "temporary_tasks" RENAME TO "tasks"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "player_id" integer, "completed_at" datetime, "created_at" datetime NOT NULL, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_tasks"("id", "description", "total_focus_seconds", "player_id") SELECT "id", "description", "total_focus_seconds", "player_id" FROM "tasks"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`ALTER TABLE "temporary_tasks" RENAME TO "tasks"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "created_at" date NOT NULL DEFAULT (datetime('now')), "player_id" integer, CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_point_history"("id", "type", "amount", "created_at", "player_id") SELECT "id", "type", "amount", "created_at", "player_id" FROM "point_history"`,
    );
    await queryRunner.query(`DROP TABLE "point_history"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_point_history" RENAME TO "point_history"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_date" date NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_point"("id", "player_id", "amount", "created_date") SELECT "id", "player_id", "amount", "created_date" FROM "daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_point" RENAME TO "daily_point"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_at" datetime NOT NULL, "last_focus_start_time" datetime, "current_task_id" integer, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5e0d8534eec1ca1de41d315cca8" FOREIGN KEY ("current_task_id") REFERENCES "tasks" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_seconds", "status", "created_at", "last_focus_start_time", "current_task_id", "player_id") SELECT "id", "total_focus_seconds", "status", "created_at", "last_focus_start_time", "current_task_id", "player_id" FROM "daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_focus_time" RENAME TO "daily_focus_time"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_github_activity"("id", "type", "count", "created_date", "player_id") SELECT "id", "type", "count", "created_date", "player_id" FROM "daily_github_activity"`,
    );
    await queryRunner.query(`DROP TABLE "daily_github_activity"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" text NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_github_activity"("id", "type", "count", "created_date", "player_id") SELECT "id", "type", "count", "created_date", "player_id" FROM "temporary_daily_github_activity"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
    await queryRunner.query(
      `ALTER TABLE "daily_focus_time" RENAME TO "temporary_daily_focus_time"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_at" text NOT NULL, "last_focus_start_time" datetime, "current_task_id" integer, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5e0d8534eec1ca1de41d315cca8" FOREIGN KEY ("current_task_id") REFERENCES "tasks" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_focus_time"("id", "total_focus_seconds", "status", "created_at", "last_focus_start_time", "current_task_id", "player_id") SELECT "id", "total_focus_seconds", "status", "created_at", "last_focus_start_time", "current_task_id", "player_id" FROM "temporary_daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "daily_point" RENAME TO "temporary_daily_point"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_date" text NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_point"("id", "player_id", "amount", "created_date") SELECT "id", "player_id", "amount", "created_date" FROM "temporary_daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "point_history" RENAME TO "temporary_point_history"`,
    );
    await queryRunner.query(
      `CREATE TABLE "point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "created_at" text NOT NULL DEFAULT (datetime('now')), "player_id" integer, CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "point_history"("id", "type", "amount", "created_at", "player_id") SELECT "id", "type", "amount", "created_at", "player_id" FROM "temporary_point_history"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_point_history"`);
    await queryRunner.query(`ALTER TABLE "tasks" RENAME TO "temporary_tasks"`);
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "player_id" integer, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "tasks"("id", "description", "total_focus_seconds", "player_id") SELECT "id", "description", "total_focus_seconds", "player_id" FROM "temporary_tasks"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_tasks"`);
    await queryRunner.query(`ALTER TABLE "tasks" RENAME TO "temporary_tasks"`);
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "completed_date" text, "created_date" text NOT NULL, "player_id" integer, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "tasks"("id", "description", "total_focus_seconds", "player_id") SELECT "id", "description", "total_focus_seconds", "player_id" FROM "temporary_tasks"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_tasks"`);
    await queryRunner.query(
      `ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" text NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_github_activity"("id", "type", "count", "created_date", "player_id") SELECT "id", "type", "count", "created_date", "player_id" FROM "temporary_daily_github_activity"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
    await queryRunner.query(
      `ALTER TABLE "daily_focus_time" RENAME TO "temporary_daily_focus_time"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" text NOT NULL, "last_focus_start_time" datetime, "current_task_id" integer, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5e0d8534eec1ca1de41d315cca8" FOREIGN KEY ("current_task_id") REFERENCES "tasks" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_focus_time"("id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "current_task_id", "player_id") SELECT "id", "total_focus_seconds", "status", "created_at", "last_focus_start_time", "current_task_id", "player_id" FROM "temporary_daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "daily_point" RENAME TO "temporary_daily_point"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_date" text NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_point"("id", "player_id", "amount", "created_date") SELECT "id", "player_id", "amount", "created_date" FROM "temporary_daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "point_history" RENAME TO "temporary_point_history"`,
    );
    await queryRunner.query(
      `CREATE TABLE "point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "created_at" text NOT NULL DEFAULT (datetime('now')), "player_id" integer, CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "point_history"("id", "type", "amount", "created_at", "player_id") SELECT "id", "type", "amount", "created_at", "player_id" FROM "temporary_point_history"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_point_history"`);
  }
}
