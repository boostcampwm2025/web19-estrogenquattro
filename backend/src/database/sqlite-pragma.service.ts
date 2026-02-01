import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SqlitePragmaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SqlitePragmaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const type = (this.dataSource.options as any)?.type;
    if (type !== 'sqlite') return;

    const qr = this.dataSource.createQueryRunner();
    try {
      await qr.connect();
      const jm = await qr.query('PRAGMA journal_mode=DELETE;');
      await qr.query('PRAGMA synchronous=NORMAL;');
      await qr.query('PRAGMA busy_timeout=5000;');
      await qr.query('PRAGMA foreign_keys=ON;');
      this.logger.log(
        `SQLite PRAGMAs applied: journal_mode=DELETE (${JSON.stringify(jm)}), synchronous=NORMAL, busy_timeout=5000, foreign_keys=ON`,
      );
    } catch (e) {
      this.logger.error(`Failed to apply SQLite PRAGMAs: ${e}`);
    } finally {
      await qr.release();
    }
  }
}
