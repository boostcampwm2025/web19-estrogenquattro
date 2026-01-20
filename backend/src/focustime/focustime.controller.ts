import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FocusTimeService } from './focustime.service';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';
import { FocusStatus } from './entites/daily-focus-time.entity';

interface FocusTimeResponse {
  id: number | null;
  totalFocusMinutes: number;
  status: FocusStatus;
  createdDate: string;
  lastFocusStartTime: string | null;
}

interface FocusTimeResponse {
  id: number | null;
  totalFocusMinutes: number;
  status: FocusStatus;
  createdDate: string;
  lastFocusStartTime: string | null;
}
>>>>>>> 6708b70 (fix: 기록이 없는 날짜를 조회하면 0을 반환하도록 수정)

@Controller('api/focustime')
@UseGuards(JwtGuard)
export class FocustimeController {
  constructor(private readonly focusTimeService: FocusTimeService) {}

  @Get(':playerId')
  async getFocusTime(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query('date') date: string,
  ): Promise<FocusTimeResponse> {
    const focusTime = await this.focusTimeService.getFocusTime(playerId, date);

    if (!focusTime) {
      return {
        id: null,
        totalFocusMinutes: 0,
        status: FocusStatus.RESTING,
        createdDate: date,
        lastFocusStartTime: null,
      };
    }

    return {
      id: focusTime.id,
      totalFocusMinutes: focusTime.totalFocusMinutes,
      status: focusTime.status,
      createdDate: String(focusTime.createdDate),
      lastFocusStartTime: focusTime.lastFocusStartTime
        ? focusTime.lastFocusStartTime.toISOString()
        : null,
    };
  }
}
