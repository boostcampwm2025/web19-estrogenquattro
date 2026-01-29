import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auto1769615965615 implements MigrationInterface {
  name = 'Auto1769615965615';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pets" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar(20) NOT NULL, "description" varchar(100) NOT NULL, "species" varchar(20) NOT NULL, "evolution_stage" integer NOT NULL, "evolution_required_exp" integer NOT NULL, "actual_img_url" varchar(100) NOT NULL, "silhouette_img_url" varchar(100) NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE "players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_pets" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "exp" integer NOT NULL DEFAULT (0))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_pet_codex" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "acquired_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "completed_date" date, "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `CREATE TABLE "point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "repository" varchar(100), "description" varchar(200), "created_at" date NOT NULL DEFAULT (datetime('now')), "player_id" integer)`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "amount" integer NOT NULL, "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `CREATE TABLE "global_state" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "progress" integer NOT NULL DEFAULT (0), "contributions" text NOT NULL DEFAULT ('{}'), "map_index" integer NOT NULL DEFAULT (0), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "current_task_id" integer, "player_id" integer)`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"), CONSTRAINT "FK_279a87ba077e90d4af617c09282" FOREIGN KEY ("equipped_pet_id") REFERENCES "pets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_players"("id", "social_id", "nickname", "equipped_pet_id", "total_point") SELECT "id", "social_id", "nickname", "equipped_pet_id", "total_point" FROM "players"`,
    );
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_players" RENAME TO "players"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_user_pets" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "exp" integer NOT NULL DEFAULT (0), CONSTRAINT "FK_9843e513b878caccbdfb93b4435" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_bca077a5621ab4380965bfa272b" FOREIGN KEY ("pet_id") REFERENCES "pets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_pets"("id", "player_id", "pet_id", "exp") SELECT "id", "player_id", "pet_id", "exp" FROM "user_pets"`,
    );
    await queryRunner.query(`DROP TABLE "user_pets"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_pets" RENAME TO "user_pets"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_user_pet_codex" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "acquired_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_7bde14a3cfebaafe0deea50c679" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_f1007bdc0010bc0504a210f6a5b" FOREIGN KEY ("pet_id") REFERENCES "pets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_pet_codex"("id", "player_id", "pet_id", "acquired_at") SELECT "id", "player_id", "pet_id", "acquired_at" FROM "user_pet_codex"`,
    );
    await queryRunner.query(`DROP TABLE "user_pet_codex"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_pet_codex" RENAME TO "user_pet_codex"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "completed_date" date, "created_date" date NOT NULL, "player_id" integer, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_tasks"("id", "description", "total_focus_seconds", "completed_date", "created_date", "player_id") SELECT "id", "description", "total_focus_seconds", "completed_date", "created_date", "player_id" FROM "tasks"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`ALTER TABLE "temporary_tasks" RENAME TO "tasks"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "repository" varchar(100), "description" varchar(200), "created_at" date NOT NULL DEFAULT (datetime('now')), "player_id" integer, CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_point_history"("id", "type", "amount", "repository", "description", "created_at", "player_id") SELECT "id", "type", "amount", "repository", "description", "created_at", "player_id" FROM "point_history"`,
    );
    await queryRunner.query(`DROP TABLE "point_history"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_point_history" RENAME TO "point_history"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "amount" integer NOT NULL, "created_date" date NOT NULL, "player_id" integer, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_point"("id", "amount", "created_date", "player_id") SELECT "id", "amount", "created_date", "player_id" FROM "daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_point" RENAME TO "daily_point"`,
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
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "current_task_id" integer, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5e0d8534eec1ca1de41d315cca8" FOREIGN KEY ("current_task_id") REFERENCES "tasks" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "current_task_id", "player_id") SELECT "id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "current_task_id", "player_id" FROM "daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_focus_time" RENAME TO "daily_focus_time"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_focus_time" RENAME TO "temporary_daily_focus_time"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "current_task_id" integer, "player_id" integer)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_focus_time"("id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "current_task_id", "player_id") SELECT "id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "current_task_id", "player_id" FROM "temporary_daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_github_activity"("id", "type", "count", "created_date", "player_id") SELECT "id", "type", "count", "created_date", "player_id" FROM "temporary_daily_github_activity"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
    await queryRunner.query(
      `ALTER TABLE "daily_point" RENAME TO "temporary_daily_point"`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "amount" integer NOT NULL, "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_point"("id", "amount", "created_date", "player_id") SELECT "id", "amount", "created_date", "player_id" FROM "temporary_daily_point"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_point"`);
    await queryRunner.query(
      `ALTER TABLE "point_history" RENAME TO "temporary_point_history"`,
    );
    await queryRunner.query(
      `CREATE TABLE "point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "repository" varchar(100), "description" varchar(200), "created_at" date NOT NULL DEFAULT (datetime('now')), "player_id" integer)`,
    );
    await queryRunner.query(
      `INSERT INTO "point_history"("id", "type", "amount", "repository", "description", "created_at", "player_id") SELECT "id", "type", "amount", "repository", "description", "created_at", "player_id" FROM "temporary_point_history"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_point_history"`);
    await queryRunner.query(`ALTER TABLE "tasks" RENAME TO "temporary_tasks"`);
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "completed_date" date, "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `INSERT INTO "tasks"("id", "description", "total_focus_seconds", "completed_date", "created_date", "player_id") SELECT "id", "description", "total_focus_seconds", "completed_date", "created_date", "player_id" FROM "temporary_tasks"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_tasks"`);
    await queryRunner.query(
      `ALTER TABLE "user_pet_codex" RENAME TO "temporary_user_pet_codex"`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_pet_codex" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "acquired_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "user_pet_codex"("id", "player_id", "pet_id", "acquired_at") SELECT "id", "player_id", "pet_id", "acquired_at" FROM "temporary_user_pet_codex"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_user_pet_codex"`);
    await queryRunner.query(
      `ALTER TABLE "user_pets" RENAME TO "temporary_user_pets"`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_pets" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "exp" integer NOT NULL DEFAULT (0))`,
    );
    await queryRunner.query(
      `INSERT INTO "user_pets"("id", "player_id", "pet_id", "exp") SELECT "id", "player_id", "pet_id", "exp" FROM "temporary_user_pets"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_user_pets"`);
    await queryRunner.query(
      `ALTER TABLE "players" RENAME TO "temporary_players"`,
    );
    await queryRunner.query(
      `CREATE TABLE "players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "players"("id", "social_id", "nickname", "equipped_pet_id", "total_point") SELECT "id", "social_id", "nickname", "equipped_pet_id", "total_point" FROM "temporary_players"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_players"`);
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(`DROP TABLE "daily_github_activity"`);
    await queryRunner.query(`DROP TABLE "global_state"`);
    await queryRunner.query(`DROP TABLE "daily_point"`);
    await queryRunner.query(`DROP TABLE "point_history"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "user_pet_codex"`);
    await queryRunner.query(`DROP TABLE "user_pets"`);
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(`DROP TABLE "pets"`);
  }
}
