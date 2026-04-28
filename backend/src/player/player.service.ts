import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Player } from './entites/player.entity';
import { PointHistory, PointType } from '../pointhistory/entities/point-history.entity';
import { WriteLockService } from '../database/write-lock.service';

export type ItemType = 'effect' | 'lang';

interface CatalogItem {
  cost: number;
  type: ItemType;
}

const ITEM_CATALOG: Record<string, CatalogItem> = {
  sparkle: { cost: 200, type: 'effect' },
  electric: { cost: 200, type: 'effect' },
  fire: { cost: 200, type: 'effect' },
  js: { cost: 100, type: 'lang' },
  ts: { cost: 100, type: 'lang' },
  rust: { cost: 100, type: 'lang' },
  java: { cost: 100, type: 'lang' },
  python: { cost: 100, type: 'lang' },
  kotlin: { cost: 100, type: 'lang' },
  C: { cost: 100, type: 'lang' },
  Cp: { cost: 100, type: 'lang' },
  go: { cost: 100, type: 'lang' },
  haskell: { cost: 100, type: 'lang' },
  nest: { cost: 100, type: 'lang' },
  pytorch: { cost: 100, type: 'lang' },
  react: { cost: 100, type: 'lang' },
  spring: { cost: 100, type: 'lang' },
  tensor: { cost: 100, type: 'lang' },
  swift: { cost: 100, type: 'lang' },
};

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly dataSource: DataSource,
    private readonly writeLock: WriteLockService,
  ) {}

  async findOneById(id: number): Promise<Player> {
    const player = await this.playerRepository.findOne({
      where: { id },
      relations: ['equippedPet'],
    });
    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }
    return player;
  }

  async findBySocialId(socialId: number): Promise<Player | null> {
    return this.playerRepository.findOne({ where: { socialId } });
  }

  async findOrCreateBySocialId(
    socialId: number,
    nickname: string,
  ): Promise<Player> {
    const existing = await this.findBySocialId(socialId);
    if (existing) {
      if (existing.nickname !== nickname) {
        existing.nickname = nickname;
        return this.playerRepository.save(existing);
      }
      return existing;
    }

    const player = this.playerRepository.create({
      socialId,
      nickname,
    });
    return this.playerRepository.save(player);
  }

  async completeOnboarding(playerId: number): Promise<void> {
    const player = await this.findOneById(playerId);
    player.isNewbie = false;
    await this.playerRepository.save(player);
  }

  async updateEquippedEffect(
    playerId: number,
    effectId: string | null,
  ): Promise<void> {
    await this.playerRepository.update(playerId, { equippedEffect: effectId });
  }

  async updateEquippedLang(
    playerId: number,
    langKey: string | null,
  ): Promise<void> {
    await this.playerRepository.update(playerId, { equippedLang: langKey });
  }

  async purchaseItem(
    playerId: number,
    itemId: string,
  ): Promise<{ totalPoint: number }> {
    const catalogItem = ITEM_CATALOG[itemId];
    if (!catalogItem) {
      throw new BadRequestException(`Unknown item: ${itemId}`);
    }

    return this.writeLock.runExclusive(() =>
      this.dataSource.transaction(async (manager) => {
        const playerRepo = manager.getRepository(Player);
        const historyRepo = manager.getRepository(PointHistory);

        const player = await playerRepo.findOne({ where: { id: playerId } });
        if (!player) throw new NotFoundException('Player not found');

        if (player.totalPoint < catalogItem.cost) {
          throw new BadRequestException('포인트가 부족합니다');
        }

        player.totalPoint -= catalogItem.cost;
        await playerRepo.save(player);

        await historyRepo.save(
          historyRepo.create({
            player: { id: playerId },
            type: PointType.PURCHASE,
            amount: -catalogItem.cost,
            description: itemId,
            activityAt: null,
          }),
        );

        return { totalPoint: player.totalPoint };
      }),
    );
  }
}
