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
