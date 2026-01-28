import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FocusTimeService } from './focustime.service';
import { JwtGuard } from '../auth/jwt.guard';
import { FocusStatus } from './entites/daily-focus-time.entity';
import { ParseDatePipe } from '../common/parse-date.pipe';

interface FocusTimeResponse {
  id: number | null;
  totalFocusSeconds: number;
  status: FocusStatus;
  createdAt: string;
  lastFocusStartTime: string | null;
}

@Controller('api/focustime')
@UseGuards(JwtGuard)
export class FocustimeController {
  constructor(private readonly focusTimeService: FocusTimeService) {}

  @Get(':playerId')
  async getFocusTime(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query('startAt', ParseDatePipe) startAt: Date,
    @Query('endAt', ParseDatePipe) endAt: Date,
  ): Promise<FocusTimeResponse> {
    const focusTime = await this.focusTimeService.getFocusTime(
      playerId,
      startAt,
      endAt,
    );

    return {
      id: focusTime.id,
      totalFocusSeconds: focusTime.totalFocusSeconds,
      status: focusTime.status,
      createdAt: focusTime.createdAt.toISOString(),
      lastFocusStartTime: focusTime.lastFocusStartTime
        ? focusTime.lastFocusStartTime.toISOString()
        : null,
    };
  }
}
