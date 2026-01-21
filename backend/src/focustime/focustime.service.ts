import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DailyFocusTime, FocusStatus } from './entites/daily-focus-time.entity';
import { Player } from '../player/entites/player.entity';
import { Task } from '../task/entites/task.entity';

@Injectable()
export class FocusTimeService {
  private readonly logger = new Logger(FocusTimeService.name);

  constructor(
    @InjectRepository(DailyFocusTime)
    private readonly focusTimeRepository: Repository<DailyFocusTime>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  /**
   * 오늘 날짜를 YYYY-MM-DD 문자열로 반환
   * SQLite date 타입과 비교할 때 사용
   */
  private getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async findOrCreate(player: Player): Promise<DailyFocusTime> {
    const today = this.getTodayDateString();

    const existing = await this.focusTimeRepository.findOne({
      where: {
        player: { id: player.id },
        createdDate: today as unknown as Date,
      },
    });

    if (existing) {
      return existing;
    }

    const newFocusTime = this.focusTimeRepository.create({
      player,
      totalFocusSeconds: 0,
      status: FocusStatus.RESTING,
      createdDate: today as unknown as Date,
    });

    return this.focusTimeRepository.save(newFocusTime);
  }

  async startFocusing(
    playerId: number,
    taskId?: number,
  ): Promise<DailyFocusTime> {
    const now = new Date();
    const today = this.getTodayDateString();

    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: today as unknown as Date,
      },
      relations: ['player'],
    });

    if (!focusTime) {
      throw new NotFoundException(
        'FocusTime record not found. Please join the room first.',
      );
    }

    // 이미 집중 중이었다면 이전 집중 시간을 먼저 누적 (태스크 전환 시 시간 누락 방지)
    if (
      focusTime.status === FocusStatus.FOCUSING &&
      focusTime.lastFocusStartTime
    ) {
      const diffMs = now.getTime() - focusTime.lastFocusStartTime.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      focusTime.totalFocusSeconds += diffSeconds;

      // 이전 Task의 집중 시간 업데이트
      if (focusTime.currentTaskId && diffSeconds > 0) {
        await this.addFocusTimeToTask(
          playerId,
          focusTime.currentTaskId,
          diffSeconds,
        );
        this.logger.log(
          `Task switch: saved ${diffSeconds}s for previous task ${focusTime.currentTaskId}`,
        );
      }
    }

    focusTime.status = FocusStatus.FOCUSING;
    focusTime.lastFocusStartTime = now;
    focusTime.currentTaskId = taskId ?? null;

    if (taskId) {
      this.logger.log(`Player ${playerId} started focusing on task ${taskId}`);
    }

    return this.focusTimeRepository.save(focusTime);
  }

  async startResting(playerId: number): Promise<DailyFocusTime> {
    const now = new Date();
    const today = this.getTodayDateString();

    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: today as unknown as Date,
      },
      relations: ['player'],
    });

    if (!focusTime) {
      throw new NotFoundException(
        'FocusTime record not found. Please join the room first.',
      );
    }

    let diffSeconds = 0;

    if (
      focusTime.status === FocusStatus.FOCUSING &&
      focusTime.lastFocusStartTime
    ) {
      const diffMs = now.getTime() - focusTime.lastFocusStartTime.getTime();
      diffSeconds = Math.floor(diffMs / 1000);
      focusTime.totalFocusSeconds += diffSeconds;

      // 집중 중이던 Task가 있으면 해당 Task의 집중 시간도 업데이트
      if (focusTime.currentTaskId && diffSeconds > 0) {
        await this.addFocusTimeToTask(
          playerId,
          focusTime.currentTaskId,
          diffSeconds,
        );
      }
    }

    focusTime.status = FocusStatus.RESTING;
    // currentTaskId는 유지 (다음 집중 시작 시 덮어쓰여짐)

    return this.focusTimeRepository.save(focusTime);
  }

  /**
   * Task의 집중 시간을 추가 (소유권 검증 + 원자적 업데이트)
   */
  private async addFocusTimeToTask(
    playerId: number,
    taskId: number,
    seconds: number,
  ): Promise<void> {
    const result = await this.taskRepository
      .createQueryBuilder()
      .update()
      .set({ totalFocusSeconds: () => `total_focus_seconds + ${seconds}` })
      .where('id = :taskId', { taskId })
      .andWhere('player_id = :playerId', { playerId })
      .execute();

    if (!result.affected) {
      this.logger.warn(
        `Task ${taskId} not found or not owned by player ${playerId}, skipping focus time update`,
      );
      return;
    }

    this.logger.log(`Added ${seconds}s to task ${taskId}`);
  }

  async findAllStatuses(playerIds: number[]): Promise<DailyFocusTime[]> {
    if (playerIds.length === 0) return [];

    const today = this.getTodayDateString();
    return this.focusTimeRepository.find({
      where: {
        player: { id: In(playerIds) },
        createdDate: today as unknown as Date,
      },
      relations: ['player'],
    });
  }

  async getFocusTime(
    playerId: number,
    date: string,
  ): Promise<DailyFocusTime | null> {
    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: date as unknown as Date,
      },
    });

    if (!focusTime) {
      const emptyRecord = new DailyFocusTime();
      emptyRecord.totalFocusSeconds = 0;
      emptyRecord.status = FocusStatus.RESTING;
      emptyRecord.createdDate = date as unknown as Date;
      emptyRecord.lastFocusStartTime = null as unknown as Date;
      return emptyRecord;
    }

    return focusTime;
  }
}
