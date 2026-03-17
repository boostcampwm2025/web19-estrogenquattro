import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guestbook } from './entities/guestbook.entity';
import { PlayerService } from '../player/player.service';
import { getTodayKstDateString } from '../util/date.util';
import { QueryFailedError } from 'typeorm';
import { Player } from '../player/entites/player.entity';

export type SortOrder = 'ASC' | 'DESC';

export interface GuestbookReadState {
  latestEntryId: number | null;
  lastReadEntryId: number;
  hasUnread: boolean;
}

@Injectable()
export class GuestbookService {
  constructor(
    @InjectRepository(Guestbook)
    private readonly guestbookRepository: Repository<Guestbook>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly playerService: PlayerService,
  ) {}

  async create(playerId: number, content: string) {
    const normalizedContent = content?.trim();
    if (!normalizedContent || normalizedContent.length > 200) {
      throw new BadRequestException('방명록은 1~200자까지 작성 가능합니다');
    }

    const player = await this.playerService.findOneById(playerId);
    const writeDate = getTodayKstDateString();

    await this.checkDailyLimit(playerId, writeDate);

    const guestbook = this.guestbookRepository.create({
      content: normalizedContent,
      player,
      writeDate,
    });

    try {
      const saved = await this.guestbookRepository.save(guestbook);
      return {
        ...saved,
        player: { id: player.id, nickname: player.nickname },
      };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.message.includes('UNIQUE')
      ) {
        throw new BadRequestException(
          '방명록은 하루에 한 번만 작성할 수 있습니다',
        );
      }
      throw error;
    }
  }

  async findByCursor(
    cursor?: number,
    limit: number = 20,
    order: SortOrder = 'DESC',
  ): Promise<{ items: Guestbook[]; nextCursor: number | null }> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const qb = this.guestbookRepository
      .createQueryBuilder('guestbook')
      .leftJoin('guestbook.player', 'player')
      .addSelect(['player.id', 'player.nickname'])
      .orderBy('guestbook.id', order)
      .take(safeLimit + 1);

    if (cursor !== undefined) {
      if (order === 'ASC') {
        qb.where('guestbook.id > :cursor', { cursor });
      } else {
        qb.where('guestbook.id < :cursor', { cursor });
      }
    }

    const items = await qb.getMany();

    const hasNext = items.length > safeLimit;
    if (hasNext) {
      items.pop();
    }

    const nextCursor =
      hasNext && items.length > 0 ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  async delete(guestbookId: number, playerId: number): Promise<void> {
    const guestbook = await this.guestbookRepository.findOne({
      where: { id: guestbookId },
      relations: ['player'],
    });

    if (!guestbook) {
      throw new NotFoundException(`Guestbook with ID ${guestbookId} not found`);
    }

    if (guestbook.player.id !== playerId) {
      throw new ForbiddenException('본인이 작성한 방명록만 삭제할 수 있습니다');
    }

    await this.guestbookRepository.remove(guestbook);
  }

  async getReadState(playerId: number): Promise<GuestbookReadState> {
    const player = await this.playerRepository.findOne({
      where: { id: playerId },
      select: {
        id: true,
        lastReadGuestbookEntryId: true,
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }

    const latestEntryId = await this.getLatestEntryId();
    const lastReadEntryId = player.lastReadGuestbookEntryId ?? 0;

    return {
      latestEntryId,
      lastReadEntryId,
      hasUnread: latestEntryId !== null && latestEntryId > lastReadEntryId,
    };
  }

  async markAsRead(playerId: number): Promise<GuestbookReadState> {
    const player = await this.playerRepository.findOne({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${playerId} not found`);
    }

    const latestEntryId = await this.getLatestEntryId();
    const currentLastReadEntryId = player.lastReadGuestbookEntryId ?? 0;
    const nextLastReadEntryId =
      latestEntryId === null
        ? currentLastReadEntryId
        : Math.max(currentLastReadEntryId, latestEntryId);

    if (player.lastReadGuestbookEntryId !== nextLastReadEntryId) {
      player.lastReadGuestbookEntryId = nextLastReadEntryId;
      await this.playerRepository.save(player);
    }

    return {
      latestEntryId,
      lastReadEntryId: nextLastReadEntryId,
      hasUnread: latestEntryId !== null && latestEntryId > nextLastReadEntryId,
    };
  }

  private async checkDailyLimit(playerId: number, writeDate: string) {
    const existing = await this.guestbookRepository.findOne({
      where: {
        player: { id: playerId },
        writeDate: writeDate,
      },
    });

    if (existing) {
      throw new BadRequestException(
        '방명록은 하루에 한 번만 작성할 수 있습니다',
      );
    }
  }

  private async getLatestEntryId(): Promise<number | null> {
    const latestEntry = await this.guestbookRepository
      .createQueryBuilder('guestbook')
      .select('guestbook.id', 'id')
      .orderBy('guestbook.id', 'DESC')
      .limit(1)
      .getRawOne<{ id: number }>();

    return latestEntry?.id ?? null;
  }
}
