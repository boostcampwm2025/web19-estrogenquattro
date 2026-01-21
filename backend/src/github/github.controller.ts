import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GithubService } from './github.service';
import { PlayerId } from '../auth/player-id.decorator';
import { GithubEventsResDto } from './dto/get-github-events.res';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('api/github')
@UseGuards(JwtGuard)
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('events')
  async getEvents(
    @PlayerId() playerId: number,
    @Query('date') date: string,
  ): Promise<GithubEventsResDto> {
    return this.githubService.getPlayerActivitiesByDate(playerId, date);
  }
}
