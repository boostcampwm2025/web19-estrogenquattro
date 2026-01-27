import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
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

    // 포인트 내역 저장
    await this.pointHistoryService.addHistory(
      playerId,
      activityType,
      totalPoint,
    );

    const existingRecord = await this.dailyPointRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: today,
      },
    });

    if (existingRecord) {
      existingRecord.amount += totalPoint;
      return this.dailyPointRepository.save(existingRecord);
    }

    const newRecord = this.dailyPointRepository.create({
      player: { id: playerId },
      amount: totalPoint,
      createdDate: today,
    });

    return this.dailyPointRepository.save(newRecord);
  }
}
