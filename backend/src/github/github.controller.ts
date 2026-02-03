import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { GithubService } from './github.service';
import { PlayerId } from '../auth/player-id.decorator';
import { GithubEventsResDto } from './dto/get-github-events.res';
import { JwtGuard } from '../auth/jwt.guard';
import { ParseDatePipe } from '../common/parse-date.pipe';
import { User } from '../auth/user.interface';

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

  @Get('users/:username')
  async getUser(@Param('username') username: string, @Req() req: Request) {
    const user = req.user as User;
    return this.githubService.getUser(user.accessToken, username);
  }

  @Get('users/:username/follow-status')
  async getFollowStatus(
    @Param('username') username: string,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    return this.githubService.checkFollowStatus(user.accessToken, username);
  }

  @Put('users/:username/follow')
  async followUser(@Param('username') username: string, @Req() req: Request) {
    const user = req.user as User;
    return this.githubService.followUser(user.accessToken, username);
  }

  @Delete('users/:username/follow')
  async unfollowUser(@Param('username') username: string, @Req() req: Request) {
    const user = req.user as User;
    return this.githubService.unfollowUser(user.accessToken, username);
  }
}
