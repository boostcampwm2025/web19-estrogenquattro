import {
  BadRequestException,
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PointHistoryService, HistoryRank } from './point-history.service';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';
import { ParseDatePipe } from '../common/parse-date.pipe';
import { PointHistory, PointType } from './entities/point-history.entity';

@Controller('api')
@UseGuards(JwtGuard)
export class PointHistoryController {
  constructor(private readonly pointHistoryService: PointHistoryService) {}

  @Get('git-histories')
  async getGitHistories(
    @PlayerId() currentPlayerId: number,
    @Query('targetPlayerId', ParseIntPipe) targetPlayerId: number,
    @Query('startAt', ParseDatePipe) startAt: Date,
    @Query('endAt', ParseDatePipe) endAt: Date,
  ): Promise<PointHistory[]> {
    return this.pointHistoryService.getGitEventHistories(
      currentPlayerId,
      targetPlayerId,
      startAt,
      endAt,
    );
  }

  @Get('history-ranks')
  async getHistoryRanks(
    @Query('type') type: PointType,
    @Query('weekendStartAt', ParseDatePipe) weekendStartAt: Date,
  ): Promise<HistoryRank[]> {
    if (!(Object.values(PointType) as string[]).includes(type)) {
      throw new BadRequestException('Invalid PointType');
    }
    return this.pointHistoryService.getHistoryRanks(type, weekendStartAt);
  }
}
