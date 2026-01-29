import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GithubService } from './github.service';
import { PlayerId } from '../auth/player-id.decorator';
import { GithubEventsResDto } from './dto/get-github-events.res';
import { JwtGuard } from '../auth/jwt.guard';
import { ParseDatePipe } from '../common/parse-date.pipe';

@Controller('api/github')
@UseGuards(JwtGuard)
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('events')
  async getEvents(
    @PlayerId() currentPlayerId: number,
    @Query('playerId') playerId: string | undefined,
    @Query('startAt', ParseDatePipe) startAt: Date,
    @Query('endAt', ParseDatePipe) endAt: Date,
  ): Promise<GithubEventsResDto> {
    let targetPlayerId = currentPlayerId;
    if (playerId) {
      const parsed = Number(playerId);
      if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException('Invalid playerId');
      }
      targetPlayerId = parsed;
    }
    return this.githubService.getPlayerActivities(
      targetPlayerId,
      startAt,
      endAt,
    );
  }
}
