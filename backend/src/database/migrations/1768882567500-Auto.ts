import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auto1768882567500 implements MigrationInterface {
  name = 'Auto1768882567500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "pets" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar(20) NOT NULL, "description" varchar(100) NOT NULL, "species" varchar(20) NOT NULL, "evolution_stage" integer NOT NULL, "evolution_required_exp" integer NOT NULL, "actual_img_url" varchar(100) NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_pets" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "exp" integer NOT NULL DEFAULT (0))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_pet_codex" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "pet_id" integer NOT NULL, "acquired_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "completed_date" date, "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer NOT NULL, "amount" integer NOT NULL, "created_date" date NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer)`,
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
      `CREATE TABLE "temporary_tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "completed_date" date, "created_date" date NOT NULL, "player_id" integer, CONSTRAINT "FK_30af1f6bf51b7c9491f5dae67b9" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_tasks"("id", "description", "total_focus_minutes", "completed_date", "created_date", "player_id") SELECT "id", "description", "total_focus_minutes", "completed_date", "created_date", "player_id" FROM "tasks"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`ALTER TABLE "temporary_tasks" RENAME TO "tasks"`);
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
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_minutes", "status", "created_date", "last_focus_start_time", "player_id") SELECT "id", "total_focus_minutes", "status", "created_date", "last_focus_start_time", "player_id" FROM "daily_focus_time"`,
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
      `CREATE TABLE "daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer)`,
    );
    await queryRunner.query(
      `INSERT INTO "daily_focus_time"("id", "total_focus_minutes", "status", "created_date", "last_focus_start_time", "player_id") SELECT "id", "total_focus_minutes", "status", "created_date", "last_focus_start_time", "player_id" FROM "temporary_daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_daily_focus_time"`);
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
    await queryRunner.query(`ALTER TABLE "tasks" RENAME TO "temporary_tasks"`);
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "description" varchar(100) NOT NULL, "total_focus_minutes" integer NOT NULL DEFAULT (0), "completed_date" date, "created_date" date NOT NULL, "player_id" integer)`,
    );
    await queryRunner.query(
      `INSERT INTO "tasks"("id", "description", "total_focus_minutes", "completed_date", "created_date", "player_id") SELECT "id", "description", "total_focus_minutes", "completed_date", "created_date", "player_id" FROM "temporary_tasks"`,
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
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(`DROP TABLE "daily_point"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "user_pet_codex"`);
    await queryRunner.query(`DROP TABLE "user_pets"`);
    await queryRunner.query(`DROP TABLE "pets"`);
    await queryRunner.query(`DROP TABLE "players"`);
  }
}
