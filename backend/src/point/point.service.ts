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

  async getPoints(playerId: number): Promise<DailyPoint[]> {
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return this.dailyPointRepository.find({
      where: {
        player: { id: playerId },
        createdAt: Between(oneYearAgo, now),
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

      if (existingRecord) {
        existingRecord.amount += totalPoint;
        return dailyPointRepo.save(existingRecord);
      }

      const newRecord = dailyPointRepo.create({
        player: { id: playerId },
        amount: totalPoint,
        createdAt: now,
      });

      const player = await playerRepo.findOne({ where: { id: playerId } });
      if (!player) {
        throw new NotFoundException('Player not found');
      }
      player.totalPoint += totalPoint;

      return dailyPointRepo.save(newRecord);
    });
  }
}
