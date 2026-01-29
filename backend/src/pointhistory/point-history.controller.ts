import {
  BadRequestException,
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PointHistoryService } from './point-history.service';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';
import { ParseDatePipe } from '../common/parse-date.pipe';
import { PointHistory } from './entities/point-history.entity';

@Controller('api')
@UseGuards(JwtGuard)
export class PointHistoryController {
  constructor(private readonly pointHistoryService: PointHistoryService) {}

  @Get('git-histories')
  async getGitHistories(
    @PlayerId() currentPlayerId: number,
    @Query('targetPlayerId', ParseIntPipe) targetPlayerIdStr: number,
    @Query('startAt', ParseDatePipe) startAt: Date,
    @Query('endAt', ParseDatePipe) endAt: Date,
  ): Promise<PointHistory[]> {
    const targetPlayerId = Number(targetPlayerIdStr);
    if (
      Number.isNaN(targetPlayerId) ||
      !Number.isInteger(targetPlayerId) ||
      targetPlayerId <= 0
    ) {
      throw new BadRequestException('Invalid targetPlayerId');
    }
    return this.pointHistoryService.getGitEventHistories(
      currentPlayerId,
      targetPlayerId,
      startAt,
      endAt,
    );
  }
}
