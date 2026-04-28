import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ChatHistoryService } from './chat-history.service';

@Controller('api/chat-messages')
@UseGuards(JwtGuard)
export class ChatController {
  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  @Get()
  async findByRoomId(
    @Query('roomId') roomId?: string,
    @Query('cursor') cursor?: string,
  ) {
    const normalizedRoomId = roomId?.trim();
    if (!normalizedRoomId) {
      throw new BadRequestException('roomId는 필수입니다');
    }

    if (normalizedRoomId.length > 50) {
      throw new BadRequestException('roomId는 50자 이하여야 합니다');
    }

    const parsedCursor =
      cursor !== undefined ? Number.parseInt(cursor, 10) : undefined;
    if (cursor !== undefined && Number.isNaN(parsedCursor)) {
      throw new BadRequestException('cursor는 정수여야 합니다');
    }

    return this.chatHistoryService.findByRoomId(
      normalizedRoomId,
      parsedCursor,
    );
  }
}
