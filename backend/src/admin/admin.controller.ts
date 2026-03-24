import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CreateBanDto } from './dto/create-ban.dto';
import { PlayerId } from '../auth/player-id.decorator';
import { PlayerGateway } from '../player/player.gateway';

@Controller('api/admin')
@UseGuards(JwtGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly playerGateway: PlayerGateway,
  ) {}

  @Get('verification')
  verify() {
    return { isAdmin: true };
  }

  @Get('players')
  async getPlayers(@Query('search') search?: string) {
    return this.adminService.getPlayers(search);
  }

  @Post('ban')
  async ban(@PlayerId() adminId: number, @Body() dto: CreateBanDto) {
    const ban = await this.adminService.ban(adminId, dto);
    this.playerGateway.disconnectPlayer(dto.targetPlayerId, dto.reason ?? null);
    return ban;
  }

  @Delete('ban/:playerId')
  async unban(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.adminService.unban(playerId);
  }
}
