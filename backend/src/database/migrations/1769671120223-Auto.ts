import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1769671120223 implements MigrationInterface {
    name = 'Auto1769671120223'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "global_state" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "progress" integer NOT NULL DEFAULT (0), "contributions" text NOT NULL DEFAULT ('{}'), "map_index" integer NOT NULL DEFAULT (0), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "global_state"`);
    }

}
