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
  ): Promise<Player> {
    const existing = await this.findBySocialId(socialId);
    if (existing) return existing;

    const player = this.playerRepository.create({
      socialId,
      nickname,
      totalPoint: 0,
    });
    return this.playerRepository.save(player);
  }
}
