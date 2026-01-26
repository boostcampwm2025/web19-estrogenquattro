import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { DailyPoint } from './entities/daily-point.entity';
import { GithubActivityType } from '../github/entities/daily-github-activity.entity';

const ACTIVITY_POINT_MAP: Record<GithubActivityType, number> = {
  [GithubActivityType.COMMITTED]: 3,
  [GithubActivityType.PR_OPEN]: 2,
  [GithubActivityType.PR_MERGED]: 4,
  [GithubActivityType.PR_REVIEWED]: 4,
  [GithubActivityType.ISSUE_OPEN]: 1,
};

@Injectable()
export class PointService {
  constructor(
    @InjectRepository(DailyPoint)
    private readonly dailyPointRepository: Repository<DailyPoint>,
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
    activityType: GithubActivityType,
  ): Promise<DailyPoint> {
    const today = new Date().toISOString().slice(0, 10);
    const point = ACTIVITY_POINT_MAP[activityType];

    const existingRecord = await this.dailyPointRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: today,
      },
    });

    if (existingRecord) {
      existingRecord.amount += point;
      return this.dailyPointRepository.save(existingRecord);
    }

    const newRecord = this.dailyPointRepository.create({
      player: { id: playerId },
      amount: point,
      createdDate: today,
    });

    return this.dailyPointRepository.save(newRecord);
  }
}
