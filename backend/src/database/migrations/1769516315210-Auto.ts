import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1769516315210 implements MigrationInterface {
    name = 'Auto1769516315210'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "created_at" date NOT NULL DEFAULT (datetime('now')), "player_id" integer, "repository" varchar(100), "description" varchar(200), CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_point_history"("id", "type", "amount", "created_at", "player_id") SELECT "id", "type", "amount", "created_at", "player_id" FROM "point_history"`);
        await queryRunner.query(`DROP TABLE "point_history"`);
        await queryRunner.query(`ALTER TABLE "temporary_point_history" RENAME TO "point_history"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "point_history" RENAME TO "temporary_point_history"`);
        await queryRunner.query(`CREATE TABLE "point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "created_at" date NOT NULL DEFAULT (datetime('now')), "player_id" integer, CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "point_history"("id", "type", "amount", "created_at", "player_id") SELECT "id", "type", "amount", "created_at", "player_id" FROM "temporary_point_history"`);
        await queryRunner.query(`DROP TABLE "temporary_point_history"`);
    }

}
