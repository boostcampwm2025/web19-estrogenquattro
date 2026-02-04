import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, Repository } from 'typeorm';
import { PointHistory, PointType } from './entities/point-history.entity';
import { Player } from '../player/entites/player.entity';
import { FocusTimeService } from '../focustime/focustime.service';

export interface HistoryRank {
  playerId: number;
  nickname: string;
  count: number;
  rank: number;
}

@Injectable()
export class PointHistoryService {
  constructor(
    @InjectRepository(PointHistory)
    private readonly pointHistoryRepository: Repository<PointHistory>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly focusTimeService: FocusTimeService,
  ) {}

  async addHistory(
    manager: EntityManager,
    playerId: number,
    type: PointType,
    amount: number,
    repository?: string | null,
    description?: string | null,
    activityAt?: Date | null,
  ): Promise<PointHistory> {
    const historyRepo = manager.getRepository(PointHistory);

    const history = historyRepo.create({
      player: { id: playerId },
      type,
      amount,
      repository: repository ?? null,
      description: description ?? null,
      activityAt: activityAt ?? null,
      createdAt: activityAt ?? undefined, // activityAt이 있으면 createdAt으로 사용
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
      throw new NotFoundException(
        `Player with ID ${currentPlayerId} not found`,
      );
    }

    return this.pointHistoryRepository.find({
      where: {
        player: { id: targetPlayerId },
        createdAt: Between(startAt, endAt),
      },
    });
  }

  async getHistoryRanks(
    type: PointType,
    weekendStartAt: Date,
  ): Promise<HistoryRank[]> {
    // FOCUSED 타입은 FocusTimeService에서 조회
    if (type === PointType.FOCUSED) {
      return this.focusTimeService.getFocusRanks(weekendStartAt);
    }

    const weekendEndAt = new Date(weekendStartAt);
    weekendEndAt.setDate(weekendEndAt.getDate() + 7);

    const results = await this.pointHistoryRepository
      .createQueryBuilder('ph')
      .select('ph.player_id', 'playerId')
      .addSelect('player.nickname', 'nickname')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('ph.player', 'player')
      .where('ph.type = :type', { type })
      .andWhere('ph.createdAt >= :startAt AND ph.createdAt < :endAt', {
        startAt: weekendStartAt,
        endAt: weekendEndAt,
      })
      .groupBy('ph.player_id')
      .orderBy('count', 'DESC')
      .getRawMany();

    // 동점자 처리: 같은 개수면 같은 등수
    let currentRank = 1;
    let previousCount: number | null = null;

    return results.map(
      (row: { playerId: number; nickname: string; count: string }, index) => {
        const count = Number(row.count);

        if (previousCount !== null && count < previousCount) {
          currentRank = index + 1;
        }
        previousCount = count;

        return {
          playerId: row.playerId,
          nickname: row.nickname,
          count,
          rank: currentRank,
        };
      },
    );
  }
}
