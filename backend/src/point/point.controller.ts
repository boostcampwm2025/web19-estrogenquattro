import { Controller, Get, UseGuards } from '@nestjs/common';
import { PointService } from './point.service';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';
import { DailyPoint } from './entities/daily-point.entity';

@UseGuards(JwtGuard)
@Controller('api/points')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get()
  async getPoints(@PlayerId() playerId: number): Promise<DailyPoint[]> {
    return this.pointService.getPoints(playerId);
  }
}
