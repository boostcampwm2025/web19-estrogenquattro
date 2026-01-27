import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { DailyPoint } from './entities/daily-point.entity';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { PointHistoryService } from '../pointhistory/point-history.service';

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
    const today = new Date().toISOString().slice(0, 10);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10);

    return this.dailyPointRepository.find({
      where: {
        player: { id: playerId },
        createdDate: Between(oneYearAgoStr, today),
      },
    });
  }

  async addPoint(
    playerId: number,
    activityType: PointType,
    count: number,
  ): Promise<DailyPoint> {
    const today = new Date().toISOString().slice(0, 10);
    const totalPoint = ACTIVITY_POINT_MAP[activityType] * count;

    return this.dataSource.transaction(async (manager) => {
      const dailyPointRepo = manager.getRepository(DailyPoint);

      // 포인트 내역 저장 (트랜잭션 내에서)
      await this.pointHistoryService.addHistoryWithManager(
        manager,
        playerId,
        activityType,
        totalPoint,
      );

      // 비관적 락으로 조회 (다른 트랜잭션이 동시에 수정 못하게 차단)
      const existingRecord = await dailyPointRepo.findOne({
        where: {
          player: { id: playerId },
          createdDate: today,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (existingRecord) {
        existingRecord.amount += totalPoint;
        return dailyPointRepo.save(existingRecord);
      }

      const newRecord = dailyPointRepo.create({
        player: { id: playerId },
        amount: totalPoint,
        createdDate: today,
      });

      return dailyPointRepo.save(newRecord);
    });
  }
}
