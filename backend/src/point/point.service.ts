import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { DailyPoint } from './entities/daily-point.entity';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { PointHistoryService } from '../pointhistory/point-history.service';

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
    repository?: string | null,
    description?: string | null,
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
        repository,
        description,
      );

      // 트랜잭션 내에서 조회 (SQLite는 트랜잭션 레벨 잠금 사용)
      const existingRecord = await dailyPointRepo.findOne({
        where: {
          player: { id: playerId },
          createdDate: today,
        },
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
