import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentTaskId1769001000000 implements MigrationInterface {
  name = 'AddCurrentTaskId1769001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // daily_focus_time 테이블에 current_task_id 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE "daily_focus_time" ADD COLUMN "current_task_id" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite는 ALTER TABLE DROP COLUMN을 지원하지 않으므로 테이블 재생성
    await queryRunner.query(
      `CREATE TABLE "temporary_daily_focus_time" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "total_focus_seconds" integer NOT NULL DEFAULT (0), "status" varchar CHECK( "status" IN ('FOCUSING','RESTING') ) NOT NULL DEFAULT ('RESTING'), "created_date" date NOT NULL, "last_focus_start_time" datetime, "player_id" integer, CONSTRAINT "FK_e63850eaef9faa36a57ab190e15" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_daily_focus_time"("id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "player_id") SELECT "id", "total_focus_seconds", "status", "created_date", "last_focus_start_time", "player_id" FROM "daily_focus_time"`,
    );
    await queryRunner.query(`DROP TABLE "daily_focus_time"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_daily_focus_time" RENAME TO "daily_focus_time"`,
    );
  }
}
