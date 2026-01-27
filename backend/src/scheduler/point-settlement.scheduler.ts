import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { PointService } from '../point/point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { getYesterdayKstRange } from '../util/date.util';

@Injectable()
export class PointSettlementScheduler {
  private readonly logger = new Logger(PointSettlementScheduler.name);

  constructor(
    @InjectRepository(DailyFocusTime)
    private readonly dailyFocusTimeRepository: Repository<DailyFocusTime>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly pointService: PointService,
  ) {}

  // KST 자정 = UTC 15:00 (전날)
  @Cron('0 0 15 * * *')
  async handlePointSettlement(): Promise<void> {
    this.logger.log('Starting daily point settlement...');

    const { start, end } = getYesterdayKstRange();
    this.logger.log(
      `Settlement range: ${start.toISOString()} ~ ${end.toISOString()}`,
    );

    await this.settleFocusTimePoints(start, end);
    await this.settleTaskCompletedPoints(start, end);

    this.logger.log('Daily point settlement completed.');
  }

  private async settleFocusTimePoints(start: Date, end: Date): Promise<void> {
    const focusTimes = await this.dailyFocusTimeRepository.find({
      where: { createdAt: Between(start, end) },
      relations: ['player'],
    });

    this.logger.log(`Found ${focusTimes.length} focus time records for range`);

    for (const focusTime of focusTimes) {
      const pointCount = Math.floor(focusTime.totalFocusSeconds / 1800); // 30분(1800초)당 1포인트

      if (pointCount > 0) {
        try {
          await this.pointService.addPoint(
            focusTime.player.id,
            PointType.FOCUSED,
            pointCount,
          );
          this.logger.log(
            `Awarded ${pointCount} FOCUSED points to player ${focusTime.player.id}`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to award FOCUSED points to player ${focusTime.player.id}: ${message}`,
          );
        }
      }
    }
  }

  private async settleTaskCompletedPoints(
    start: Date,
    end: Date,
  ): Promise<void> {
    const completedTasks = await this.taskRepository.find({
      where: { completedAt: Between(start, end) },
      relations: ['player'],
    });

    this.logger.log(`Found ${completedTasks.length} completed tasks for range`);

    // 플레이어별 task 개수 집계 - O(n)
    const playerTaskCount = new Map<number, number>();
    for (const task of completedTasks) {
      const playerId = task.player.id;
      playerTaskCount.set(playerId, (playerTaskCount.get(playerId) ?? 0) + 1);
    }

    for (const [playerId, count] of playerTaskCount) {
      try {
        await this.pointService.addPoint(
          playerId,
          PointType.TASK_COMPLETED,
          count,
        );
        this.logger.log(
          `Awarded ${count} TASK_COMPLETED points to player ${playerId}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to award TASK_COMPLETED points to player ${playerId}: ${message}`,
        );
      }
    }
  }
}
