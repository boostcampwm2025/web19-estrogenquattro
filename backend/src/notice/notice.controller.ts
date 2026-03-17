import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../admin/admin.guard';
import { PlayerId } from '../auth/player-id.decorator';
import { NoticeService } from './notice.service';
import { NoticeGateway } from './notice.gateway';

@Controller('api/notices')
@UseGuards(JwtGuard)
export class NoticeController {
  constructor(
    private readonly noticeService: NoticeService,
    private readonly noticeGateway: NoticeGateway,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  async create(
    @PlayerId() authorId: number,
    @Body() dto: CreateNotificationDto,
  ) {
    const notice = await this.noticeService.create(authorId, dto);
    this.noticeGateway.broadcastNotice(notice);
    return notice;
  }

  @Get('new')
  async checkNewNotice(@PlayerId() playerId: number) {
    const notice = await this.noticeService.getLatestUnreadNotice(playerId);
    return notice ? notice : {};
  }

  @Post(':id/marking')
  markAsRead(
    @Param('id', ParseIntPipe) noticeId: number,
    @PlayerId() playerId: number,
  ) {
    return this.noticeService.markAsRead(noticeId, playerId);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.noticeService.findByPage(page, limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) noticeId: number) {
    return this.noticeService.findOne(noticeId);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseIntPipe) noticeId: number,
    @Body() dto: UpdateNotificationDto,
  ) {
    return this.noticeService.update(noticeId, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) noticeId: number) {
    return this.noticeService.remove(noticeId);
  }
}
