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

interface FocusTimeResponse {
  id: number | null;
  totalFocusMinutes: number;
  status: FocusStatus;
  createdDate: string;
  lastFocusStartTime: string | null;
}

@Controller('api/focustime')
@UseGuards(JwtGuard)
export class FocustimeController {
  constructor(private readonly focusTimeService: FocusTimeService) {}

  @Get(':playerId')
  async getFocusTime(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query('date') date: string,
  ): Promise<FocusTimeResponse> {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const focusTime = await this.focusTimeService.getFocusTime(
      playerId,
      targetDate,
    );

    if (!focusTime) {
      return {
        id: null,
        totalFocusMinutes: 0,
        status: FocusStatus.RESTING,
        createdDate: targetDate,
        lastFocusStartTime: null,
      };
    }

    return {
      id: focusTime.id,
      totalFocusMinutes: focusTime.totalFocusMinutes,
      status: focusTime.status,
      createdDate: new Date(focusTime.createdDate).toISOString().slice(0, 10),
      lastFocusStartTime: focusTime.lastFocusStartTime
        ? focusTime.lastFocusStartTime.toISOString()
        : null,
    };
  }
}
