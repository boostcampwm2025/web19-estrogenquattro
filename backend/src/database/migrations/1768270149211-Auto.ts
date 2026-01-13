import { MigrationInterface, QueryRunner } from 'typeorm';

export class Auto1768270149211 implements MigrationInterface {
  name = 'Auto1768270149211';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "tasks"
                             (
                               "id"               integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                               "player_id"        bigint,
                               "description"      varchar(100),
                               "duration_minutes" integer NOT NULL DEFAULT (0),
                               "completed_date"   date    NOT NULL,
                               "created_date"     date    NOT NULL
                             )`);
    await queryRunner.query(`CREATE TABLE "players"
                             (
                               "id"                  integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                               "social_id"           bigint      NOT NULL,
                               "nickname"            varchar(20) NOT NULL,
                               "primary_user_pet_id" bigint,
                               "total_point"         integer     NOT NULL DEFAULT (0),
                               CONSTRAINT "UQ_e304f5048f92add68e1f8c0ce03" UNIQUE ("social_id")
                             )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
  }
}
