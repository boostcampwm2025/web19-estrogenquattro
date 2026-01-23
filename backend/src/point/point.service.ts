import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { DailyPoint } from './entities/daily-point.entity';

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
}
