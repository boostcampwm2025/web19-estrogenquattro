import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { DailyPoint } from './entities/daily-point.entity';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { PointHistoryService } from '../pointhistory/point-history.service';
import { getTodayKstRangeUtc } from '../util/date.util';
import { Player } from '../player/entites/player.entity';

export const ACTIVITY_POINT_MAP: Record<PointType, number> = {
  [PointType.COMMITTED]: 2,
  [PointType.PR_OPEN]: 2,
  [PointType.PR_MERGED]: 4,
  [PointType.PR_REVIEWED]: 4,
  [PointType.ISSUE_OPEN]: 1,
  [PointType.TASK_COMPLETED]: 1,
  [PointType.FOCUSED]: 1,
};

@Injectable()
export class PointService {
  constructor(
    @InjectRepository(DailyPoint)
    private readonly dailyPointRepository: Repository<DailyPoint>,
    private readonly pointHistoryService: PointHistoryService,
    private readonly dataSource: DataSource,
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
  ): Promise<DailyPoint> {
    const now = new Date();
    const totalPoint = ACTIVITY_POINT_MAP[activityType] * count;

    return this.dataSource.transaction(async (manager) => {
      const dailyPointRepo = manager.getRepository(DailyPoint);
      const playerRepo: Repository<Player> = manager.getRepository(Player);

      await this.pointHistoryService.addHistoryWithManager(
        manager,
        playerId,
        activityType,
        totalPoint,
      );
      const { start, end } = getTodayKstRangeUtc();

      const existingRecord = await dailyPointRepo
        .createQueryBuilder('dp')
        .where('dp.player.id = :playerId', { playerId })
        .andWhere('dp.createdAt BETWEEN :start AND :end', { start, end })
        .getOne();

      const player = await playerRepo.findOne({ where: { id: playerId } });
      if (!player) {
        throw new NotFoundException('Player not found');
      }
      player.totalPoint += totalPoint;
      await playerRepo.save(player);

      if (existingRecord) {
        existingRecord.amount += totalPoint;
        return dailyPointRepo.save(existingRecord);
      }

      const newRecord = dailyPointRepo.create({
        player: { id: playerId },
        amount: totalPoint,
        createdAt: now,
      });
      return dailyPointRepo.save(newRecord);
    });
  }
}
