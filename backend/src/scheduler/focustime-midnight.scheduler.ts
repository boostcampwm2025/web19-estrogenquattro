import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { getYesterdayKstRange } from '../util/date.util';

@Injectable()
export class FocusTimeMidnightScheduler {
  private readonly logger = new Logger(FocusTimeMidnightScheduler.name);

  constructor(
    @InjectRepository(DailyFocusTime)
    private readonly focusTimeRepository: Repository<DailyFocusTime>,
  ) {}

  /**
   * KST 00:00 (UTC 15:00)에 실행
   * 어제의 focustime 레코드를 조회해서 오늘 날짜로 새 레코드 생성
   */
  @Cron('0 0 0 * * *', { timeZone: 'Asia/Seoul' })
  async handleMidnight(): Promise<void> {
    this.logger.log('Midnight scheduler started - copying focustime records');

    const { start, end } = getYesterdayKstRange();
    const now = new Date();

    // 어제의 모든 focustime 레코드 조회
    const yesterdayRecords = await this.focusTimeRepository.find({
      where: {
        createdAt: Between(start, end),
      },
      relations: ['player'],
    });

    if (yesterdayRecords.length === 0) {
      return;
    }

    // 새 레코드 생성 (createdAt만 현재 시간으로, 나머지는 기존 값 유지)
    const newRecords = yesterdayRecords.map((record) =>
      this.focusTimeRepository.create({
        player: record.player,
        totalFocusSeconds: 0,
        status: record.status,
        createdAt: now,
        lastFocusStartTime: record.lastFocusStartTime,
        currentTaskId: record.currentTaskId,
        currentTask: record.currentTask,
      }),
    );
    await this.focusTimeRepository.save(newRecords);
    this.logger.log(
      `Successfully created ${newRecords.length} new focustime records for today`,
    );
  }
}
