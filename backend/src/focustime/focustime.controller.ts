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
import { ParseDatePipe } from '../common/parse-date.pipe';

interface FocusTimeResponse {
  totalFocusSeconds: number;
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
      totalFocusSeconds: focusTime.totalFocusSeconds,
    };
  }
}
