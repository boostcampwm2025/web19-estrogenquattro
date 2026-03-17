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
} from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../admin/admin.guard';
import { PlayerId } from '../auth/player-id.decorator';
import { NoticeService } from './notice.service';
import { NoticeGateway } from './notice.gateway';

@Controller('api/notices')
@UseGuards(JwtGuard, AdminGuard)
export class NoticeController {
  constructor(
    private readonly noticeService: NoticeService,
    private readonly noticeGateway: NoticeGateway,
  ) {}

  @Post()
  async create(
    @PlayerId() authorId: number,
    @Body() dto: CreateNotificationDto,
  ) {
    const notice = await this.noticeService.create(authorId, dto);
    this.noticeGateway.broadcastNotice(notice);
    return notice;
  }

  @Get()
  findAll() {
    return this.noticeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotificationDto,
  ) {
    return this.noticeService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.noticeService.remove(id);
  }
}
