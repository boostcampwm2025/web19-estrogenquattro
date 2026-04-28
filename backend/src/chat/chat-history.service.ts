import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../player/entites/player.entity';
import { WriteLockService } from '../database/write-lock.service';
import { ChatHistory } from './entities/chat-history.entity';

const CHAT_HISTORY_PAGE_SIZE = 30;

export interface ChatHistoryPage {
  items: ChatHistory[];
  nextCursor: number | null;
}

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectRepository(ChatHistory)
    private readonly chatHistoryRepository: Repository<ChatHistory>,
    private readonly writeLockService: WriteLockService,
  ) {}

  async create(
    playerId: number,
    roomId: string,
    nickname: string,
    message: string,
  ): Promise<ChatHistory> {
    return this.writeLockService.runExclusive(async () => {
      const chatHistory = this.chatHistoryRepository.create({
        roomId,
        nickname,
        message,
        player: { id: playerId } as Player,
      });

      return this.chatHistoryRepository.save(chatHistory);
    });
  }

  async findByRoomId(
    roomId: string,
    cursor?: number,
  ): Promise<ChatHistoryPage> {
    const qb = this.chatHistoryRepository
      .createQueryBuilder('chatHistory')
      .select([
        'chatHistory.id',
        'chatHistory.roomId',
        'chatHistory.nickname',
        'chatHistory.message',
        'chatHistory.createdAt',
      ])
      .where('chatHistory.roomId = :roomId', { roomId })
      .orderBy('chatHistory.id', 'DESC')
      .take(CHAT_HISTORY_PAGE_SIZE + 1);

    if (cursor !== undefined) {
      qb.andWhere('chatHistory.id < :cursor', { cursor });
    }

    const items = await qb.getMany();
    const hasNext = items.length > CHAT_HISTORY_PAGE_SIZE;

    if (hasNext) {
      items.pop();
    }

    items.reverse();

    return {
      items,
      nextCursor: hasNext && items.length > 0 ? items[0].id : null,
    };
  }
}
