import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FocusTimeService } from './focustime.service';
import { DailyFocusTime } from './entites/daily-focus-time.entity';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('api/focustime')
@UseGuards(JwtGuard)
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
