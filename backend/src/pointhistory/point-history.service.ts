import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PointHistory, PointType } from './entities/point-history.entity';

@Injectable()
export class PointHistoryService {
  constructor(
    @InjectRepository(PointHistory)
    private readonly pointHistoryRepository: Repository<PointHistory>,
  ) {}

  async addHistory(
    playerId: number,
    type: PointType,
    amount: number,
  ): Promise<PointHistory> {
    const history = this.pointHistoryRepository.create({
      player: { id: playerId },
      type,
      amount,
    });

    return this.pointHistoryRepository.save(history);
  }

  async addHistoryWithManager(
    manager: EntityManager,
    playerId: number,
    type: PointType,
    amount: number,
  ): Promise<PointHistory> {
    const historyRepo = manager.getRepository(PointHistory);

    const history = historyRepo.create({
      player: { id: playerId },
      type,
      amount,
    });

    return historyRepo.save(history);
  }
}
