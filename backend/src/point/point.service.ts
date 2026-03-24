import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { DailyPoint } from './entities/daily-point.entity';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { PointHistoryService } from '../pointhistory/point-history.service';
import { getTodayKstRangeUtc } from '../util/date.util';
import { Player } from '../player/entites/player.entity';
import { WriteLockService } from '../database/write-lock.service';

export interface PlayerRank {
  playerId: number;
  nickname: string;
  totalPoints: number;
  rank: number;
}

export const ACTIVITY_POINT_MAP: Record<PointType, number> = {
  [PointType.COMMITTED]: 2, // 커밋 1회
  [PointType.PR_OPEN]: 2, // PR 생성
  [PointType.PR_MERGED]: 4, // PR 머지
  [PointType.PR_REVIEWED]: 4, // PR 리뷰
  [PointType.ISSUE_OPEN]: 1, // 이슈 생성
  [PointType.TASK_COMPLETED]: 1, // 투두 완료
  [PointType.FOCUSED]: 1, // 집중 30분
};

@Injectable()
export class PointService {
  private readonly logger = new Logger(PointService.name);
  constructor(
    @InjectRepository(DailyPoint)
    private readonly dailyPointRepository: Repository<DailyPoint>,
    private readonly pointHistoryService: PointHistoryService,
    private readonly dataSource: DataSource,
    private readonly writeLock: WriteLockService,
  ) {}

  async getPoints(
    currentPlayerId: number,
    targetPlayerId: number,
    currentTime: Date,
  ): Promise<DailyPoint[]> {
    // currentPlayerId와 targetPlayerId 존재 여부 검증
    const playerRepo = this.dataSource.getRepository(Player);

    const [currentPlayer, targetPlayer] = await Promise.all([
      playerRepo.findOne({ where: { id: currentPlayerId } }),
      playerRepo.findOne({ where: { id: targetPlayerId } }),
    ]);

    if (!currentPlayer) {
      throw new NotFoundException(
        `Player with ID ${currentPlayerId} not found`,
      );
    }
    if (!targetPlayer) {
      throw new NotFoundException(`Player with ID ${targetPlayerId} not found`);
    }

    // currentTime 기준 1년치 데이터 조회
    const oneYearAgo = new Date(currentTime);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return this.dailyPointRepository.find({
      where: {
        player: { id: targetPlayerId },
        createdAt: Between(oneYearAgo, currentTime),
      },
    });
  }

  async addPoint(
    playerId: number,
    activityType: PointType,
    count: number,
    repository?: string | null,
    description?: string | null,
    activityAt?: Date | null,
  ): Promise<DailyPoint> {
    this.logger.log('TX START addPoint', {
      method: 'addPoint',
      playerId,
      type: activityType,
      count,
    });
    // 요청 도착 시각을 기준으로 일일 범위를 고정 (락 대기 중 자정 넘어가도 요청 시각 기준 적용)
    // activityAt이 있으면 그 시각을 기준으로 함 (어제 날짜 정산 등)
    const requestTime = activityAt ?? new Date();
    const { start, end } = getTodayKstRangeUtc(requestTime);
    const totalPoint = ACTIVITY_POINT_MAP[activityType] * count;

    const exec = () => {
      return this.dataSource.transaction(async (manager) => {
        this.logger.log('TX ACTIVE addPoint', {
          method: 'addPoint',
          playerId,
          type: activityType,
        });
        const dailyPointRepo = manager.getRepository(DailyPoint);
        const playerRepo: Repository<Player> = manager.getRepository(Player);
        // 요청 시각 기준으로 고정된 now/start/end/totalPoint 사용

        // 1) 플레이어 포인트 합계 원자 증가 (존재 확인 겸용)
        const increased = await playerRepo.increment(
          { id: playerId },
          'totalPoint',
          totalPoint,
        );
        if (!increased.affected) {
          throw new NotFoundException('Player not found');
        }

        // 2) 히스토리 기록
        await this.pointHistoryService.addHistory(
          manager,
          playerId,
          activityType,
          totalPoint,
          repository,
          description,
          activityAt,
        );

        // 3) 일일 합산: 증가 시도 → 없으면 신규 생성
        const updateRes = await manager
          .createQueryBuilder()
          .update(DailyPoint)
          .set({ amount: () => 'amount + :delta' })
          .where('player_id = :playerId', { playerId })
          .andWhere('created_at BETWEEN :start AND :end', { start, end })
          .setParameters({ delta: totalPoint })
          .execute();

        if (updateRes.affected && updateRes.affected > 0) {
          // 갱신된 레코드 반환을 위해 한 번만 조회
          const updated = await dailyPointRepo
            .createQueryBuilder('dp')
            .where('dp.player.id = :playerId', { playerId })
            .andWhere('dp.createdAt BETWEEN :start AND :end', { start, end })
            .getOne();
          this.logger.log('TX END addPoint', {
            method: 'addPoint',
            playerId,
            type: activityType,
          });
          return updated!;
        }

        const newRecord = dailyPointRepo.create({
          player: { id: playerId },
          amount: totalPoint,
          createdAt: requestTime,
        });
        const inserted = await dailyPointRepo.save(newRecord);
        this.logger.log('TX END addPoint', {
          method: 'addPoint',
          playerId,
          type: activityType,
        });
        return inserted;
      });
    };

    return this.writeLock.runExclusive(exec).finally(() => {
      this.logger.log('TX COMPLETE addPoint', {
        method: 'addPoint',
        playerId,
      });
    });
  }

  async getWeeklyRanks(weekendStartAt: Date): Promise<PlayerRank[]> {
    const weekendEndAt = new Date(weekendStartAt);
    weekendEndAt.setDate(weekendEndAt.getDate() + 7);

    const results = await this.dailyPointRepository
      .createQueryBuilder('ph')
      .select('ph.player_id', 'playerId')
      .addSelect('player.nickname', 'nickname')
      .addSelect('SUM(ph.amount)', 'totalPoints')
      .innerJoin('ph.player', 'player')
      .where('ph.createdAt >= :startAt', { startAt: weekendStartAt })
      .andWhere('ph.createdAt < :endAt', { endAt: weekendEndAt })
      .groupBy('ph.player_id')
      .orderBy('totalPoints', 'DESC')
      .getRawMany();

    let currentRank = 1;
    let previousPoints: number | null = null;

    return results.map(
      (
        row: { playerId: number; nickname: string; totalPoints: string },
        index,
      ) => {
        const totalPoints = Number(row.totalPoints);

        if (previousPoints !== null && totalPoints < previousPoints) {
          currentRank = index + 1;
        }
        previousPoints = totalPoints;

        return {
          playerId: row.playerId,
          nickname: row.nickname,
          totalPoints,
          rank: currentRank,
        };
      },
    );
  }
}
