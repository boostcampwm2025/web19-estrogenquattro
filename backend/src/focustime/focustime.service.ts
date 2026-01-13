import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DailyFocusTime, FocusStatus } from './entites/daily-focus-time.entity';
import { Player } from '../player/entites/player.entity';

@Injectable()
export class FocusTimeService {
  constructor(
    @InjectRepository(DailyFocusTime)
    private readonly focusTimeRepository: Repository<DailyFocusTime>,
  ) {}

  async findOrCreate(player: Player): Promise<DailyFocusTime> {
    const now = new Date();

    const existing = await this.focusTimeRepository.findOne({
      where: {
        player: { id: player.id },
        createdDate: now,
      },
    });

    if (existing) {
      return existing;
    }

    const newFocusTime = this.focusTimeRepository.create({
      player,
      totalFocusMinutes: 0,
      status: FocusStatus.RESTING,
      createdDate: now,
    });

    return this.focusTimeRepository.save(newFocusTime);
  }

  async startFocusing(playerId: number): Promise<DailyFocusTime> {
    const now = new Date();

    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: now,
      },
    });

    if (!focusTime) {
      throw new Error(
        'FocusTime record not found. Please join the room first.',
      );
    }

    focusTime.status = FocusStatus.FOCUSING;
    focusTime.lastFocusStartTime = now;

    return this.focusTimeRepository.save(focusTime);
  }

  async startResting(playerId: number): Promise<DailyFocusTime> {
    const now = new Date();
    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: now,
      },
    });

    if (!focusTime) {
      throw new Error(
        'FocusTime record not found. Please join the room first.',
      );
    }

    if (focusTime.status === FocusStatus.FOCUSING) {
      const diffMs = now.getTime() - focusTime.lastFocusStartTime.getTime();
      const diffMins = Math.floor(diffMs / 1000 / 60);
      focusTime.totalFocusMinutes += diffMins;
    }

    focusTime.status = FocusStatus.RESTING;

    return this.focusTimeRepository.save(focusTime);
  }

  async findAllStatuses(playerIds: number[]): Promise<DailyFocusTime[]> {
    if (playerIds.length === 0) return [];

    const now = new Date();
    return this.focusTimeRepository.find({
      where: {
        player: { id: In(playerIds) },
        createdDate: now,
      },
      relations: ['player'],
    });
  }
}
