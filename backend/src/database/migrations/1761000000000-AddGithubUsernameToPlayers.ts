/* istanbul ignore file */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGithubUsernameToPlayers1761000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "players" ADD COLUMN "github_username" varchar(39)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "players" DROP COLUMN "github_username"`,
    );
  }
}
