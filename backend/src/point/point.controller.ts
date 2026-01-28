import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PointService } from './point.service';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';
import { DailyPoint } from './entities/daily-point.entity';
import { PointType } from '../pointhistory/entities/point-history.entity';

@UseGuards(JwtGuard)
@Controller('api/points')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get()
  async getPoints(@PlayerId() playerId: number): Promise<DailyPoint[]> {
    return this.pointService.getPoints(playerId);
  }

  @Post('debug/add')
  async addDebugPoint(
    @PlayerId() playerId: number,
  ): Promise<{ success: boolean; addedPoint: number }> {
    await this.pointService.addPoint(playerId, PointType.TASK_COMPLETED, 10);
    return { success: true, addedPoint: 10 };
  }
}
