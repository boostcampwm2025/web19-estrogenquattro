import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { GuestbookService, SortOrder } from './guestbook.service';
import { CreateGuestbookDto } from './dto/create-guestbook.dto';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('api/guestbooks')
@UseGuards(JwtGuard)
export class GuestbookController {
  constructor(private readonly guestbookService: GuestbookService) {}

  @Post()
  async create(@PlayerId() playerId: number, @Body() dto: CreateGuestbookDto) {
    return this.guestbookService.create(playerId, dto.content);
  }

  @Post('read')
  async markAsRead(@PlayerId() playerId: number) {
    return this.guestbookService.markAsRead(playerId);
  }

  @Get('read-state')
  async getReadState(@PlayerId() playerId: number) {
    return this.guestbookService.getReadState(playerId);
  }

  @Get()
  async findByCursor(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('order') order?: string,
  ) {
    const parsedCursor =
      cursor !== undefined ? Number.parseInt(cursor, 10) : undefined;
    if (cursor !== undefined && Number.isNaN(parsedCursor)) {
      throw new BadRequestException('cursor는 정수여야 합니다');
    }

    const parsedLimit = limit !== undefined ? Number.parseInt(limit, 10) : 20;
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      throw new BadRequestException('limit은 1~50 범위의 정수여야 합니다');
    }
    const parsedOrder: SortOrder =
      order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    return this.guestbookService.findByCursor(
      parsedCursor,
      parsedLimit,
      parsedOrder,
    );
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @PlayerId() playerId: number,
  ) {
    await this.guestbookService.delete(id, playerId);
  }
}
