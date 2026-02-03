import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WriteLockService {
  private readonly logger = new Logger(WriteLockService.name);
  private locked = false;
  private queue: Array<() => void> = [];

  private acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.logger.log('LOCK queue updated', {
        method: 'acquire',
        queueLength: this.queue.length,
      });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
      this.logger.log('LOCK queue updated', {
        method: 'release',
        queueLength: this.queue.length,
      });
    } else {
      this.locked = false;
      this.logger.log('LOCK queue updated', {
        method: 'release',
        queueLength: 0,
      });
    }
  }

  async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}
