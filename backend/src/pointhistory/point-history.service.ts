import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, Repository } from 'typeorm';
import { PointHistory, PointType } from './entities/point-history.entity';
import { Player } from '../player/entites/player.entity';

@Injectable()
export class PointHistoryService {
  constructor(
    @InjectRepository(PointHistory)
    private readonly pointHistoryRepository: Repository<PointHistory>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
  ) {}

  async addHistoryWithManager(
    manager: EntityManager,
    playerId: number,
    type: PointType,
    amount: number,
    repository?: string | null,
    description?: string | null,
  ): Promise<PointHistory> {
    const historyRepo = manager.getRepository(PointHistory);

    const history = historyRepo.create({
      player: { id: playerId },
      type,
      amount,
      repository: repository ?? null,
      description: description ?? null,
    });

    return historyRepo.save(history);
  }

  async getGitEventHistories(
    currentPlayerId: number,
    targetPlayerId: number,
    startAt: Date,
    endAt: Date,
  ): Promise<PointHistory[]> {
    const player = await this.playerRepository.findOne({
      where: { id: currentPlayerId },
    });
    if (!player) {
      throw new NotFoundException(`Player with ID ${currentPlayerId} not found`);
    }

    return this.pointHistoryRepository.find({
      where: {
        player: { id: targetPlayerId },
        createdAt: Between(startAt, endAt),
      },
    });
  }
}
