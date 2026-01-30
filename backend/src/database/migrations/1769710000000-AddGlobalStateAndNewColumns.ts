import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlobalStateAndNewColumns1769710000000
  implements MigrationInterface
{
  name = 'AddGlobalStateAndNewColumns1769710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. global_state 테이블 추가
    await queryRunner.query(
      `CREATE TABLE "global_state" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "progress" integer NOT NULL DEFAULT (0), "contributions" text NOT NULL DEFAULT ('{}'), "map_index" integer NOT NULL DEFAULT (0), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );

    // 2. point_history.activity_at 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE "point_history" ADD COLUMN "activity_at" datetime`,
    );

    // 3. players.is_newbie 컬럼 추가 + total_point 기본값 변경 (SQLite는 ALTER TABLE 제한으로 테이블 재생성 필요)
    await queryRunner.query(
      `CREATE TABLE "temporary_players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (100), "is_newbie" boolean NOT NULL DEFAULT (1), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"), CONSTRAINT "FK_279a87ba077e90d4af617c09282" FOREIGN KEY ("equipped_pet_id") REFERENCES "pets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_players"("id", "social_id", "nickname", "equipped_pet_id", "total_point") SELECT "id", "social_id", "nickname", "equipped_pet_id", "total_point" FROM "players"`,
    );
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_players" RENAME TO "players"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // players 롤백
    await queryRunner.query(
      `ALTER TABLE "players" RENAME TO "temporary_players"`,
    );
    await queryRunner.query(
      `CREATE TABLE "players" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "social_id" bigint NOT NULL, "nickname" varchar(20) NOT NULL, "equipped_pet_id" integer, "total_point" integer NOT NULL DEFAULT (0), CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id"), CONSTRAINT "FK_279a87ba077e90d4af617c09282" FOREIGN KEY ("equipped_pet_id") REFERENCES "pets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "players"("id", "social_id", "nickname", "equipped_pet_id", "total_point") SELECT "id", "social_id", "nickname", "equipped_pet_id", "total_point" FROM "temporary_players"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_players"`);

    // point_history.activity_at 컬럼 제거 (SQLite는 DROP COLUMN 불가, 테이블 재생성 필요)
    await queryRunner.query(
      `CREATE TABLE "temporary_point_history" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "type" varchar CHECK( "type" IN ('ISSUE_OPEN','PR_OPEN','PR_MERGED','PR_REVIEWED','COMMITTED','TASK_COMPLETED','FOCUSED') ) NOT NULL, "amount" integer NOT NULL, "repository" varchar(100), "description" varchar(200), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "player_id" integer, CONSTRAINT "FK_bde9ee86c7f23ee5fff3318ce6f" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_point_history"("id", "type", "amount", "repository", "description", "created_at", "player_id") SELECT "id", "type", "amount", "repository", "description", "created_at", "player_id" FROM "point_history"`,
    );
    await queryRunner.query(`DROP TABLE "point_history"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_point_history" RENAME TO "point_history"`,
    );

    // global_state 테이블 삭제
    await queryRunner.query(`DROP TABLE "global_state"`);
  }
}
