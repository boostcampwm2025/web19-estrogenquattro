import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { DailyFocusTime } from './entites/daily-focus-time.entity';
import { Player } from '../player/entites/player.entity';
import { Task } from '../task/entites/task.entity';
import { getTodayKstRangeUtc } from '../util/date.util';

const MAX_SESSION_SECONDS = 24 * 60 * 60; // 24시간

@Injectable()
export class FocusTimeService {
  private readonly logger = new Logger(FocusTimeService.name);

  constructor(
    @InjectRepository(DailyFocusTime)
    private readonly focusTimeRepository: Repository<DailyFocusTime>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 오늘의 DailyFocusTime 레코드를 찾거나 생성
   * 트랜잭션 내에서 호출되어야 함
   */
  async findOrCreate(
    manager: EntityManager,
    player: Player,
    todayStart: Date,
  ): Promise<DailyFocusTime> {
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    this.logger.log(
      `[findOrCreate] playerId=${player.id}, todayStart=${todayStart.toISOString()}, todayEnd=${todayEnd.toISOString()}`,
    );

    const existing = await manager
      .getRepository(DailyFocusTime)
      .createQueryBuilder('ft')
      .where('ft.player.id = :playerId', { playerId: player.id })
      .andWhere('ft.createdAt BETWEEN :start AND :end', {
        start: todayStart,
        end: todayEnd,
      })
      .getOne();

    this.logger.log(
      `[findOrCreate] existing=${existing ? `id=${existing.id}, createdAt=${existing.createdAt?.toISOString()}` : 'null'}`,
    );

    if (existing) {
      return existing;
    }

    const newFocusTime = manager.create(DailyFocusTime, {
      player,
      totalFocusSeconds: 0,
      createdAt: todayStart, // KST day start 명시
    });

    const saved = await manager.save(DailyFocusTime, newFocusTime);
    this.logger.log(
      `[findOrCreate] created new record id=${saved.id}, createdAt=${saved.createdAt?.toISOString()}`,
    );

    return saved;
  }

  /**
   * 집중 시작
   * - player.lastFocusStartTime != null 이면 집중 상태
   * - 이미 집중 중이면 이전 세션 정산 후 새 세션 시작
   */
  async startFocusing(playerId: number, taskId?: number): Promise<Player> {
    const now = new Date();

    this.logger.log(`[TX START] startFocusing - playerId: ${playerId}`);
    return this.dataSource.transaction(async (manager) => {
      this.logger.log(`[TX ACTIVE] startFocusing - playerId: ${playerId}`);

      const player = await manager.findOne(Player, { where: { id: playerId } });
      if (!player) {
        throw new BadRequestException('Player not found');
      }

      // 1. taskId 정규화 (0, NaN, 음수 → null)
      const normalizedTaskId = taskId != null && taskId > 0 ? taskId : null;

      // 2. normalizedTaskId가 있으면 소유권 검증
      if (normalizedTaskId) {
        const task = await manager.findOne(Task, {
          where: { id: normalizedTaskId, player: { id: playerId } },
        });
        if (!task) {
          throw new BadRequestException(
            'Task not found or not owned by player',
          );
        }
      }

      // 3. 이미 집중 중이면 이전 집중 정산
      if (player.lastFocusStartTime) {
        await this.settleCurrentSession(manager, player, now);
      }

      // 4. 새 집중 시작
      player.focusingTaskId = normalizedTaskId;
      player.lastFocusStartTime = now;
      await manager.save(Player, player);

      if (normalizedTaskId) {
        this.logger.log(
          `Player ${playerId} started focusing on task ${normalizedTaskId}`,
        );
      } else {
        this.logger.log(`Player ${playerId} started global focusing`);
      }

      this.logger.log(`[TX END] startFocusing - playerId: ${playerId}`);
      return player;
    });
  }

  /**
   * 휴식 시작 (집중 종료)
   * - player.lastFocusStartTime이 null이면 무시
   * - 집중 시간 계산 후 daily_focus_time에 누적
   */
  async startResting(playerId: number): Promise<{
    totalFocusSeconds: number;
    sessionSeconds: number;
  }> {
    const now = new Date();

    this.logger.log(`[TX START] startResting - playerId: ${playerId}`);
    return this.dataSource.transaction(async (manager) => {
      this.logger.log(`[TX ACTIVE] startResting - playerId: ${playerId}`);

      const player = await manager.findOne(Player, { where: { id: playerId } });
      if (!player) {
        throw new BadRequestException('Player not found');
      }

      // 집중 중이 아니면 무시
      if (!player.lastFocusStartTime) {
        this.logger.log(`Player ${playerId} is not focusing, ignoring resting`);
        const todayRecord = await this.findOrCreate(
          manager,
          player,
          getTodayKstRangeUtc().start,
        );
        return {
          totalFocusSeconds: todayRecord.totalFocusSeconds,
          sessionSeconds: 0,
        };
      }

      // 세션 정산
      const sessionSeconds = await this.settleCurrentSession(
        manager,
        player,
        now,
      );

      // player 초기화
      player.focusingTaskId = null;
      player.lastFocusStartTime = null;
      await manager.save(Player, player);

      const todayRecord = await this.findOrCreate(
        manager,
        player,
        getTodayKstRangeUtc().start,
      );

      this.logger.log(`[TX END] startResting - playerId: ${playerId}`);
      return {
        totalFocusSeconds: todayRecord.totalFocusSeconds,
        sessionSeconds,
      };
    });
  }

  /**
   * 현재 세션 정산 (내부 헬퍼)
   * - 집중 시간 계산 (24시간 클램프)
   * - daily_focus_time에 누적
   * - Task에 누적 (focusingTaskId가 있고, 본인 소유 Task일 때만)
   * - player 상태는 변경하지 않음 (호출자가 처리)
   */
  private async settleCurrentSession(
    manager: EntityManager,
    player: Player,
    now: Date,
  ): Promise<number> {
    if (!player.lastFocusStartTime) {
      return 0;
    }

    // 시간 계산
    const diffMs = now.getTime() - player.lastFocusStartTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    // 유효 범위 클램프 (음수 방지 + 24시간 초과 방지)
    const validSeconds = Math.max(
      0,
      Math.min(diffSeconds, MAX_SESSION_SECONDS),
    );

    if (validSeconds > 0) {
      // 오늘 daily_focus_time에 누적
      const todayRecord = await this.findOrCreate(
        manager,
        player,
        getTodayKstRangeUtc().start,
      );
      todayRecord.totalFocusSeconds += validSeconds;
      await manager.save(DailyFocusTime, todayRecord);

      this.logger.log(
        `Settled ${validSeconds}s for player ${player.id} (daily total: ${todayRecord.totalFocusSeconds}s)`,
      );

      // Task에 누적 (focusingTaskId가 있고, 본인 소유 Task일 때만)
      if (player.focusingTaskId) {
        const result = await manager
          .createQueryBuilder()
          .update(Task)
          .set({
            totalFocusSeconds: () => `total_focus_seconds + ${validSeconds}`,
          })
          .where('id = :taskId', { taskId: player.focusingTaskId })
          .andWhere('player_id = :playerId', { playerId: player.id })
          .execute();

        if (result.affected) {
          this.logger.log(
            `Added ${validSeconds}s to task ${player.focusingTaskId}`,
          );
        } else {
          this.logger.warn(
            `Task ${player.focusingTaskId} not found or not owned by player ${player.id}, skipping task update`,
          );
        }
      }
    }

    return validSeconds;
  }

  /**
   * 접속 시 stale 세션 정리
   * - player.lastFocusStartTime이 있으면 정산 후 초기화
   */
  async settleStaleSession(playerId: number): Promise<void> {
    const now = new Date();

    return this.dataSource.transaction(async (manager) => {
      const player = await manager.findOne(Player, { where: { id: playerId } });
      if (!player) {
        return;
      }

      if (player.lastFocusStartTime) {
        this.logger.log(
          `Settling stale session for player ${playerId} (started at ${player.lastFocusStartTime.toISOString()})`,
        );

        await this.settleCurrentSession(manager, player, now);

        // player 초기화
        player.focusingTaskId = null;
        player.lastFocusStartTime = null;
        await manager.save(Player, player);
      }
    });
  }

  /**
   * 여러 플레이어의 집중 상태 조회
   * V2에서는 player 테이블에서 직접 조회
   */
  async findAllStatuses(playerIds: number[]): Promise<
    Array<{
      playerId: number;
      isFocusing: boolean;
      lastFocusStartTime: Date | null;
      focusingTaskId: number | null;
    }>
  > {
    if (playerIds.length === 0) return [];

    const players = await this.playerRepository
      .createQueryBuilder('player')
      .where('player.id IN (:...playerIds)', { playerIds })
      .getMany();

    return players.map((p) => ({
      playerId: p.id,
      isFocusing: p.lastFocusStartTime != null,
      lastFocusStartTime: p.lastFocusStartTime,
      focusingTaskId: p.focusingTaskId,
    }));
  }

  /**
   * 특정 날짜의 집중 시간 조회
   */
  async getFocusTime(
    playerId: number,
    startAt: Date,
    endAt: Date,
  ): Promise<{ totalFocusSeconds: number }> {
    const focusTime = await this.focusTimeRepository
      .createQueryBuilder('ft')
      .where('ft.player.id = :playerId', { playerId })
      .andWhere('ft.createdAt BETWEEN :startAt AND :endAt', { startAt, endAt })
      .getOne();

    return {
      totalFocusSeconds: focusTime?.totalFocusSeconds ?? 0,
    };
  }

  /**
   * 플레이어의 현재 집중 상태 조회
   */
  async getPlayerFocusStatus(playerId: number): Promise<{
    isFocusing: boolean;
    lastFocusStartTime: Date | null;
    focusingTaskId: number | null;
    totalFocusSeconds: number;
    currentSessionSeconds: number;
  }> {
    const player = await this.playerRepository.findOne({
      where: { id: playerId },
    });

    if (!player) {
      throw new BadRequestException('Player not found');
    }

    const { start, end } = getTodayKstRangeUtc();
    const todayRecord = await this.focusTimeRepository
      .createQueryBuilder('ft')
      .where('ft.player.id = :playerId', { playerId })
      .andWhere('ft.createdAt BETWEEN :start AND :end', { start, end })
      .getOne();

    const currentSessionSeconds =
      player.lastFocusStartTime != null
        ? Math.floor((Date.now() - player.lastFocusStartTime.getTime()) / 1000)
        : 0;

    return {
      isFocusing: player.lastFocusStartTime != null,
      lastFocusStartTime: player.lastFocusStartTime,
      focusingTaskId: player.focusingTaskId,
      totalFocusSeconds: todayRecord?.totalFocusSeconds ?? 0,
      currentSessionSeconds,
    };
  }
}
