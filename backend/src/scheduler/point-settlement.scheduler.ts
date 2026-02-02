import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { PointService } from '../point/point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { getYesterdayKstRange } from '../util/date.util';
import { ProgressGateway, ProgressSource } from '../github/progress.gateway';

@Injectable()
export class PointSettlementScheduler {
  private readonly logger = new Logger(PointSettlementScheduler.name);

  constructor(
    @InjectRepository(DailyFocusTime)
    private readonly dailyFocusTimeRepository: Repository<DailyFocusTime>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly pointService: PointService,
    private readonly progressGateway: ProgressGateway,
  ) {}

  // KST 24시 동작
  @Cron('0 0 0 * * *', { timeZone: 'Asia/Seoul' })
  async handlePointSettlement(): Promise<void> {
    this.logger.log('KST 24:00:00 Point Settlement Scheduling Start');

    const { start, end } = getYesterdayKstRange();
    this.logger.log('Settlement range', {
      method: 'handlePointSettlement',
      start: start.toISOString(),
      end: end.toISOString(),
    });

    await this.settleFocusTimePoints(start, end);
    await this.settleTaskCompletedPoints(start, end);

    this.logger.log('KST 24:00:00 Point Settlement Scheduling Completed');
  }

  private async settleFocusTimePoints(start: Date, end: Date): Promise<void> {
    const focusTimes = await this.dailyFocusTimeRepository.find({
      where: { createdAt: Between(start, end) },
      relations: ['player'],
    });

    this.logger.log('Found focus time records', {
      method: 'settleFocusTimePoints',
      count: focusTimes.length,
    });

    for (const focusTime of focusTimes) {
      const pointCount = Math.floor(focusTime.totalFocusSeconds / 1800); // 30분(1800초)당 1포인트

      if (pointCount > 0) {
        try {
          // addPoint + addProgress 나란히 호출
          await this.pointService.addPoint(
            focusTime.player.id,
            PointType.FOCUSED,
            pointCount,
          );
          this.progressGateway.addProgress(
            focusTime.player.nickname,
            ProgressSource.FOCUSTIME,
            pointCount,
          );
          this.logger.log('Awarded FOCUSED points', {
            method: 'settleFocusTimePoints',
            playerId: focusTime.player.id,
            pointCount,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error('Failed to award FOCUSED points', {
            method: 'settleFocusTimePoints',
            playerId: focusTime.player.id,
            error: message,
          });
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

    this.logger.log('Found completed tasks', {
      method: 'settleTaskCompletedPoints',
      count: completedTasks.length,
    });

    // 플레이어별 task 개수 집계 - O(n)
    const playerTaskData = new Map<
      number,
      { count: number; nickname: string }
    >();
    for (const task of completedTasks) {
      const playerId = task.player.id;
      const existing = playerTaskData.get(playerId);
      if (existing) {
        existing.count += 1;
      } else {
        playerTaskData.set(playerId, {
          count: 1,
          nickname: task.player.nickname,
        });
      }
    }

    for (const [playerId, { count, nickname }] of playerTaskData) {
      try {
        // addPoint + addProgress 나란히 호출
        await this.pointService.addPoint(
          playerId,
          PointType.TASK_COMPLETED,
          count,
        );
        this.progressGateway.addProgress(nickname, ProgressSource.TASK, count);
        this.logger.log('Awarded TASK_COMPLETED points', {
          method: 'settleTaskCompletedPoints',
          playerId,
          count,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to award TASK_COMPLETED points', {
          method: 'settleTaskCompletedPoints',
          playerId,
          error: message,
        });
      }
    }
  }
}
