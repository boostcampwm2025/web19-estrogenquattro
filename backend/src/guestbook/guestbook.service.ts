import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Guestbook } from './entities/guestbook.entity';
import { PlayerService } from '../player/player.service';
import { getTodayKstRangeUtc } from '../util/date.util';

export type SortOrder = 'ASC' | 'DESC';

@Injectable()
export class GuestbookService {
  constructor(
    @InjectRepository(Guestbook)
    private readonly guestbookRepository: Repository<Guestbook>,
    private readonly playerService: PlayerService,
  ) {}

  async create(playerId: number, content: string) {
    if (!content || content.length > 200) {
      throw new BadRequestException('방명록은 1~200자까지 작성 가능합니다');
    }

    const player = await this.playerService.findOneById(playerId);

    await this.checkDailyLimit(playerId);

    const guestbook = this.guestbookRepository.create({
      content,
      player,
    });

    const saved = await this.guestbookRepository.save(guestbook);
    return {
      ...saved,
      player: { id: player.id, nickname: player.nickname },
    };
  }

  async findByCursor(
    cursor?: number,
    limit: number = 20,
    order: SortOrder = 'DESC',
  ): Promise<{ items: Guestbook[]; nextCursor: number | null }> {
    const qb = this.guestbookRepository
      .createQueryBuilder('guestbook')
      .leftJoin('guestbook.player', 'player')
      .addSelect(['player.id', 'player.nickname'])
      .orderBy('guestbook.id', order)
      .take(limit + 1);

    if (cursor) {
      if (order === 'ASC') {
        qb.where('guestbook.id > :cursor', { cursor });
      } else {
        qb.where('guestbook.id < :cursor', { cursor });
      }
    }

    const items = await qb.getMany();

    const hasNext = items.length > limit;
    if (hasNext) {
      items.pop();
    }

    const nextCursor = hasNext ? items[items.length - 1].id : null;

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

  private async checkDailyLimit(playerId: number) {
    const { start } = getTodayKstRangeUtc();

    const existing = await this.guestbookRepository.findOne({
      where: {
        player: { id: playerId },
        createdAt: MoreThanOrEqual(start),
      },
    });

    if (existing) {
      throw new BadRequestException(
        '방명록은 하루에 한 번만 작성할 수 있습니다',
      );
    }
  }
}
