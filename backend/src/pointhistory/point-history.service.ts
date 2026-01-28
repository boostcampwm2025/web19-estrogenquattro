import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, Repository } from 'typeorm';
import { PointHistory, PointType } from './entities/point-history.entity';
import { PlayerService } from '../player/player.service';

@Injectable()
export class PointHistoryService {
  constructor(
    @InjectRepository(PointHistory)
    private readonly pointHistoryRepository: Repository<PointHistory>,
    private readonly playerService: PlayerService,
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

  /**
   * 특정 기간의 포인트 이력 조회
   */
  async getGitEventHistories(
    currentPlayerId: number,
    targetPlayerId: number,
    startAt: Date,
    endAt: Date,
  ): Promise<PointHistory[]> {
    // currentPlayerId 검증
    await this.playerService.findOneById(currentPlayerId);

    return this.pointHistoryRepository.find({
      where: {
        player: { id: targetPlayerId },
        createdAt: Between(startAt, endAt),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }
}
