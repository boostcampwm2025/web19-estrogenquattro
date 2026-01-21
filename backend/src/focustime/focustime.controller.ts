import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { FocusTimeService } from './focustime.service';
import { DailyFocusTime } from './entites/daily-focus-time.entity';

@Controller('api/focustime')
export class FocustimeController {
  constructor(private readonly focusTimeService: FocusTimeService) {}

  @Get(':playerId')
  async getFocusTime(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query('date') date: string,
  ): Promise<DailyFocusTime> {
    return this.focusTimeService.getFocusTime(playerId, date);
  }
}
