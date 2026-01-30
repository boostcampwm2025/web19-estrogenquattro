import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProgressGateway } from '../github/progress.gateway';

@Injectable()
export class SeasonResetScheduler {
  private readonly logger = new Logger(SeasonResetScheduler.name);

  constructor(private readonly progressGateway: ProgressGateway) {}

  /**
   * 매주 월요일 00:00 (KST) 시즌 리셋
   * Cron: 초 분 시 일 월 요일
   * '0 0 0 * * 1' = 매주 월요일 00:00:00
   */
  @Cron('0 0 0 * * 1', { timeZone: 'Asia/Seoul' })
  async handleSeasonReset(): Promise<void> {
    this.logger.log('Season reset started');
    await this.progressGateway.resetSeason();
  }
}
