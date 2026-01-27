import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1769518880077 implements MigrationInterface {
    name = 'Auto1769518880077'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_at" date NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_point"("id", "player_id", "amount", "created_at") SELECT "id", "player_id", "amount", "created_date" FROM "daily_point"`);
        await queryRunner.query(`DROP TABLE "daily_point"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_point" RENAME TO "daily_point"`);
        await queryRunner.query(`CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_at" date NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_github_activity"("id", "type", "count", "created_at", "player_id") SELECT "id", "type", "count", "created_date", "player_id" FROM "daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "temporary_daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_at" datetime NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_point"("id", "player_id", "amount", "created_at") SELECT "id", "player_id", "amount", "created_at" FROM "daily_point"`);
        await queryRunner.query(`DROP TABLE "daily_point"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_point" RENAME TO "daily_point"`);
        await queryRunner.query(`CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_at" datetime NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_github_activity"("id", "type", "count", "created_at", "player_id") SELECT "id", "type", "count", "created_at", "player_id" FROM "daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_at" date NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "daily_github_activity"("id", "type", "count", "created_at", "player_id") SELECT "id", "type", "count", "created_at", "player_id" FROM "temporary_daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "daily_point" RENAME TO "temporary_daily_point"`);
        await queryRunner.query(`CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_at" date NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "daily_point"("id", "player_id", "amount", "created_at") SELECT "id", "player_id", "amount", "created_at" FROM "temporary_daily_point"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_point"`);
        await queryRunner.query(`ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, "player_id" integer, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "daily_github_activity"("id", "type", "count", "created_date", "player_id") SELECT "id", "type", "count", "created_at", "player_id" FROM "temporary_daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "daily_point" RENAME TO "temporary_daily_point"`);
        await queryRunner.query(`CREATE TABLE "daily_point" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "player_id" integer, "amount" integer NOT NULL, "created_date" date NOT NULL, CONSTRAINT "FK_19912a03fba8a7f76db50d243fa" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "daily_point"("id", "player_id", "amount", "created_date") SELECT "id", "player_id", "amount", "created_at" FROM "temporary_daily_point"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_point"`);
    }

}
