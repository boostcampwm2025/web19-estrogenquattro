import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1768916590642 implements MigrationInterface {
    name = 'Auto1768916590642'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "temporary_daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_daily_github_activity" RENAME TO "daily_github_activity"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL)`);
        await queryRunner.query(`INSERT INTO "daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "temporary_daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL)`);
        await queryRunner.query(`INSERT INTO "daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "temporary_daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "temporary_daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
        await queryRunner.query(`ALTER TABLE "daily_github_activity" RENAME TO "temporary_daily_github_activity"`);
        await queryRunner.query(`CREATE TABLE "daily_github_activity" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED') ) NOT NULL, "player_id" integer NOT NULL, "count" integer NOT NULL DEFAULT (0), "created_date" date NOT NULL, CONSTRAINT "FK_f3db5effec9c9e17df48951c69f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "daily_github_activity"("id", "type", "player_id", "count", "created_date") SELECT "id", "type", "player_id", "count", "created_date" FROM "temporary_daily_github_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_daily_github_activity"`);
    }

}
