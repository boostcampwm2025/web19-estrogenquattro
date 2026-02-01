import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { WriteLockService } from '../database/write-lock.service';
import { DailyFocusTime, FocusStatus } from './entites/daily-focus-time.entity';
import { Player } from '../player/entites/player.entity';
import { Task } from '../task/entites/task.entity';

@Injectable()
export class FocusTimeService {
  private readonly logger = new Logger(FocusTimeService.name);

  constructor(
    @InjectRepository(DailyFocusTime)
    private readonly focusTimeRepository: Repository<DailyFocusTime>,
    private readonly dataSource: DataSource,
    private readonly writeLock: WriteLockService,
  ) {}

  async findOrCreate(player: Player, startAt: Date): Promise<DailyFocusTime> {
    const start = startAt;
    const end = new Date(startAt.getTime() + 24 * 60 * 60 * 1000 - 1);

    const existing = await this.focusTimeRepository
      .createQueryBuilder('ft')
      .leftJoinAndSelect('ft.player', 'player')
      .leftJoinAndSelect('ft.currentTask', 'currentTask')
      .where('player.id = :playerId', { playerId: player.id })
      .andWhere('ft.createdAt BETWEEN :start AND :end', { start, end })
      .getOne();

    if (existing) {
      return existing;
    }

    const newFocusTime = this.focusTimeRepository.create({
      player,
      totalFocusSeconds: 0,
      status: FocusStatus.RESTING,
      createdAt: new Date(),
    });

    return this.focusTimeRepository.save(newFocusTime);
  }

  async startFocusing(
    playerId: number,
    startAt: Date,
    taskId?: number,
  ): Promise<DailyFocusTime> {
    const now = new Date();
    const start = startAt;
    const end = new Date(startAt.getTime() + 24 * 60 * 60 * 1000 - 1);

    this.logger.log(`[TX START] startFocusing - playerId: ${playerId}`);
    return this.writeLock
      .runExclusive(() =>
        this.dataSource.transaction(async (manager) => {
          this.logger.log(`[TX ACTIVE] startFocusing - playerId: ${playerId}`);
          const focusTimeRepo = manager.getRepository(DailyFocusTime);
          const taskRepo = manager.getRepository(Task);

          const focusTime = await focusTimeRepo
            .createQueryBuilder('ft')
            .leftJoinAndSelect('ft.player', 'player')
            .leftJoinAndSelect('ft.currentTask', 'currentTask')
            .where('player.id = :playerId', { playerId })
            .andWhere('ft.createdAt BETWEEN :start AND :end', { start, end })
            .getOne();

          if (!focusTime) {
            throw new NotFoundException(
              'FocusTime record not found. Please join the room first.',
            );
          }

          // taskId 소유권 검증
          let verifiedTask: Task | null = null;
          if (taskId) {
            const task = await taskRepo.findOne({
              where: { id: taskId, player: { id: playerId } },
            });
            if (task) {
              verifiedTask = task;
            } else {
              this.logger.warn(
                `Task ${taskId} not found or not owned by player ${playerId}, ignoring taskId`,
              );
            }
          }

          // 이미 집중 중이었다면 이전 집중 시간을 먼저 누적 (태스크 전환 시 시간 누락 방지)
          const previousTaskId = focusTime.currentTask?.id ?? null;
          if (
            focusTime.status === FocusStatus.FOCUSING &&
            focusTime.lastFocusStartTime
          ) {
            const diffMs =
              now.getTime() - focusTime.lastFocusStartTime.getTime();
            const diffSeconds = Math.floor(diffMs / 1000);
            focusTime.totalFocusSeconds += diffSeconds;

            // 이전 Task의 집중 시간 업데이트
            if (previousTaskId && diffSeconds > 0) {
              await this.addFocusTimeToTask(
                manager,
                playerId,
                previousTaskId,
                diffSeconds,
              );
              this.logger.log(
                `Task switch: saved ${diffSeconds}s for previous task ${previousTaskId}`,
              );
            }
          }

          focusTime.status = FocusStatus.FOCUSING;
          focusTime.lastFocusStartTime = now;
          // Fallback: @Column과 @ManyToOne 충돌 방지를 위해 둘 다 설정
          focusTime.currentTaskId = verifiedTask?.id ?? null;
          focusTime.currentTask = verifiedTask;

          if (verifiedTask) {
            this.logger.log(
              `Player ${playerId} started focusing on task ${verifiedTask.id}`,
            );
          }

          const result = await focusTimeRepo.save(focusTime);
          this.logger.log(`[TX END] startFocusing - playerId: ${playerId}`);
          return result;
        }),
      )
      .finally(() => {
        this.logger.log(`[TX COMPLETE] startFocusing - playerId: ${playerId}`);
      });
  }

  async startResting(
    playerId: number,
    startAt?: Date,
  ): Promise<DailyFocusTime> {
    const now = new Date();

    this.logger.log(`[TX START] startResting - playerId: ${playerId}`);
    return this.writeLock
      .runExclusive(() =>
        this.dataSource.transaction(async (manager) => {
          this.logger.log(`[TX ACTIVE] startResting - playerId: ${playerId}`);
          const focusTimeRepo = manager.getRepository(DailyFocusTime);

          let focusTime: DailyFocusTime | null;

          if (startAt) {
            // startAt이 있을 때: 해당 날짜 범위로 조회
            const start = startAt;
            const end = new Date(startAt.getTime() + 24 * 60 * 60 * 1000 - 1);

            focusTime = await focusTimeRepo
              .createQueryBuilder('ft')
              .leftJoinAndSelect('ft.player', 'player')
              .leftJoinAndSelect('ft.currentTask', 'currentTask')
              .where('player.id = :playerId', { playerId })
              .andWhere('ft.createdAt BETWEEN :start AND :end', { start, end })
              .getOne();
          } else {
            // startAt이 없을 때 (disconnect): 가장 최근 focusTime 조회
            focusTime = await focusTimeRepo
              .createQueryBuilder('ft')
              .leftJoinAndSelect('ft.player', 'player')
              .leftJoinAndSelect('ft.currentTask', 'currentTask')
              .where('player.id = :playerId', { playerId })
              .orderBy('ft.createdAt', 'DESC')
              .getOne();
          }

          if (!focusTime) {
            throw new NotFoundException(
              'FocusTime record not found. Please join the room first.',
            );
          }

          let diffSeconds = 0;
          const currentTaskId = focusTime.currentTask?.id ?? null;

          if (
            focusTime.status === FocusStatus.FOCUSING &&
            focusTime.lastFocusStartTime
          ) {
            const diffMs =
              now.getTime() - focusTime.lastFocusStartTime.getTime();
            diffSeconds = Math.floor(diffMs / 1000);
            focusTime.totalFocusSeconds += diffSeconds;

            // 집중 중이던 Task가 있으면 해당 Task의 집중 시간도 업데이트
            if (currentTaskId && diffSeconds > 0) {
              await this.addFocusTimeToTask(
                manager,
                playerId,
                currentTaskId,
                diffSeconds,
              );
            }
          }

          focusTime.status = FocusStatus.RESTING;
          focusTime.currentTaskId = null;
          focusTime.currentTask = null;

          const result = await focusTimeRepo.save(focusTime);
          this.logger.log(`[TX END] startResting - playerId: ${playerId}`);
          return result;
        }),
      )
      .finally(() => {
        this.logger.log(`[TX COMPLETE] startResting - playerId: ${playerId}`);
      });
  }

  /**
   * Task의 집중 시간을 추가 (소유권 검증 + 원자적 업데이트)
   * 트랜잭션 내에서 실행되어야 함
   */
  private async addFocusTimeToTask(
    manager: EntityManager,
    playerId: number,
    taskId: number,
    seconds: number,
  ): Promise<void> {
    const result = await manager
      .createQueryBuilder()
      .update(Task)
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

  async findAllStatuses(
    playerIds: number[],
    startAt: Date,
  ): Promise<DailyFocusTime[]> {
    if (playerIds.length === 0) return [];

    const start = startAt;
    const end = new Date(startAt.getTime() + 24 * 60 * 60 * 1000 - 1);
    return this.focusTimeRepository
      .createQueryBuilder('ft')
      .leftJoinAndSelect('ft.player', 'player')
      .leftJoinAndSelect('ft.currentTask', 'currentTask')
      .where('player.id IN (:...playerIds)', { playerIds })
      .andWhere('ft.createdAt BETWEEN :start AND :end', { start, end })
      .getMany();
  }

  async getFocusTime(
    playerId: number,
    startAt: Date,
    endAt: Date,
  ): Promise<DailyFocusTime> {
    const focusTime = await this.focusTimeRepository
      .createQueryBuilder('ft')
      .where('ft.player.id = :playerId', { playerId })
      .andWhere('ft.createdAt BETWEEN :startAt AND :endAt', { startAt, endAt })
      .getOne();

    if (!focusTime) {
      const defaultFocusTime = new DailyFocusTime();
      defaultFocusTime.id = null as unknown as number;
      defaultFocusTime.totalFocusSeconds = 0;
      defaultFocusTime.status = FocusStatus.RESTING;
      defaultFocusTime.createdAt = startAt;
      defaultFocusTime.lastFocusStartTime = null as unknown as Date;
      defaultFocusTime.currentTaskId = null;
      defaultFocusTime.currentTask = null;
      return defaultFocusTime;
    }

    return focusTime;
  }
}
