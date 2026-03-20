import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from './entites/player.entity';

@Injectable()
export class PlayerService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
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
    githubUsername: string | null,
  ): Promise<Player> {
    const existing = await this.findBySocialId(socialId);
    if (existing) {
      const hasChanges =
        existing.nickname !== nickname ||
        existing.githubUsername !== githubUsername;

      if (hasChanges) {
        existing.nickname = nickname;
        existing.githubUsername = githubUsername;
        return this.playerRepository.save(existing);
      }
      return existing;
    }

    const player = this.playerRepository.create({
      socialId,
      nickname,
      githubUsername,
    });
    return this.playerRepository.save(player);
  }

  async completeOnboarding(playerId: number): Promise<void> {
    const player = await this.findOneById(playerId);
    player.isNewbie = false;
    await this.playerRepository.save(player);
  }
}
