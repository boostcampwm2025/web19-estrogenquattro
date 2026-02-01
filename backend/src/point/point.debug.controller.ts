import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PointService } from './point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyPoint } from './entities/daily-point.entity';

@Controller('api/debug/points')
export class PointDebugController {
  constructor(
    private readonly pointService: PointService,
    @InjectRepository(DailyPoint)
    private readonly dailyPointRepository: Repository<DailyPoint>,
  ) {}

  @Post('add')
  async addPointNoAuth(
    @Body()
    body: {
      playerId: number;
      type: PointType;
      count?: number;
      repository?: string | null;
      description?: string | null;
      activityAt?: string | null; // ISO string
    },
  ): Promise<{ success: true }> {
    const {
      playerId,
      type,
      count = 1,
      repository = null,
      description = null,
      activityAt = null,
    } = body || ({} as any);

    await this.pointService.addPoint(
      Number(playerId),
      type,
      Number(count),
      repository,
      description,
      activityAt ? new Date(activityAt) : null,
      { noLock: false },
    );
    return { success: true };
  }

  @Get('one')
  async getOne(
    @Query('playerId') playerId: string,
  ): Promise<DailyPoint | null> {
    const pid = Number(playerId);
    if (!Number.isFinite(pid)) return null;
    return this.dailyPointRepository.findOne({
      where: { player: { id: pid } },
      order: { createdAt: 'DESC' },
    });
  }
}
