import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PointHistory, PointType } from './entities/point-history.entity';

@Injectable()
export class PointHistoryService {
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
}
