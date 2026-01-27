import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { PointService } from '../point/point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';

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

  private getYesterdayDateString(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePointSettlement(): Promise<void> {
    this.logger.log('Starting daily point settlement...');

    const yesterday = this.getYesterdayDateString();

    await this.settleFocusTimePoints(yesterday);
    await this.settleTaskCompletedPoints(yesterday);

    this.logger.log('Daily point settlement completed.');
  }

  private async settleFocusTimePoints(dateStr: string): Promise<void> {
    const focusTimes = await this.dailyFocusTimeRepository.find({
      where: { createdDate: dateStr },
      relations: ['player'],
    });

    this.logger.log(
      `Found ${focusTimes.length} focus time records for ${dateStr}`,
    );

    for (const focusTime of focusTimes) {
      const pointCount = Math.floor(focusTime.totalFocusSeconds / 1800); // 30분(1800초)당 1포인트

      if (pointCount > 0) {
        await this.pointService.addPoint(
          focusTime.player.id,
          PointType.FOCUSED,
          pointCount,
        );
        this.logger.log(
          `Awarded ${pointCount} FOCUSED points to player ${focusTime.player.id}`,
        );
      }
    }
  }

  private async settleTaskCompletedPoints(dateStr: string): Promise<void> {
    const completedTasks = await this.taskRepository.find({
      where: { completedDate: dateStr },
      relations: ['player'],
    });

    this.logger.log(
      `Found ${completedTasks.length} completed tasks for ${dateStr}`,
    );

    // 플레이어별 task 개수 집계 - O(n)
    const playerTaskCount = new Map<number, number>();
    for (const task of completedTasks) {
      const playerId = task.player.id;
      playerTaskCount.set(playerId, (playerTaskCount.get(playerId) ?? 0) + 1);
    }

    for (const [playerId, count] of playerTaskCount) {
      await this.pointService.addPoint(
        playerId,
        PointType.TASK_COMPLETED,
        count,
      );
      this.logger.log(
        `Awarded ${count} TASK_COMPLETED points to player ${playerId}`,
      );
    }
  }
}
