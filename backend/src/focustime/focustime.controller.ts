import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FocusTimeService } from './focustime.service';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';
import { DailyFocusTime } from './entites/daily-focus-time.entity';

@UseGuards(JwtGuard)
@Controller('api/focustime')
export class FocustimeController {
  constructor(private readonly focusTimeService: FocusTimeService) {}

  @Get()
  async getFocusTime(
    @PlayerId() playerId: number,
    @Query('date') date: string,
  ): Promise<DailyFocusTime> {
    return this.focusTimeService.getFocusTime(playerId, date);
  }
}
