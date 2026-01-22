import { Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * 오늘 날짜를 YYYY-MM-DD 문자열로 반환
   * SQLite date 타입과 비교할 때 사용
   */
  private getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async findOrCreate(player: Player): Promise<DailyFocusTime> {
    const today = this.getTodayDateString();

    const existing = await this.focusTimeRepository.findOne({
      where: {
        player: { id: player.id },
        createdDate: today as unknown as Date,
      },
    });

    if (existing) {
      return existing;
    }

    const newFocusTime = this.focusTimeRepository.create({
      player,
      totalFocusSeconds: 0,
      status: FocusStatus.RESTING,
      createdDate: today as unknown as Date,
    });

    return this.focusTimeRepository.save(newFocusTime);
  }

  async startFocusing(playerId: number): Promise<DailyFocusTime> {
    const today = this.getTodayDateString();

    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: today as unknown as Date,
      },
      relations: ['player'],
    });

    if (!focusTime) {
      throw new NotFoundException(
        'FocusTime record not found. Please join the room first.',
      );
    }

    focusTime.status = FocusStatus.FOCUSING;
    focusTime.lastFocusStartTime = new Date();

    return this.focusTimeRepository.save(focusTime);
  }

  async startResting(playerId: number): Promise<DailyFocusTime> {
    const now = new Date();
    const today = this.getTodayDateString();

    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: today as unknown as Date,
      },
      relations: ['player'],
    });

    if (!focusTime) {
      throw new NotFoundException(
        'FocusTime record not found. Please join the room first.',
      );
    }

    if (
      focusTime.status === FocusStatus.FOCUSING &&
      focusTime.lastFocusStartTime
    ) {
      const diffMs = now.getTime() - focusTime.lastFocusStartTime.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      focusTime.totalFocusSeconds += diffSeconds;
    }

    focusTime.status = FocusStatus.RESTING;

    return this.focusTimeRepository.save(focusTime);
  }

  async findAllStatuses(playerIds: number[]): Promise<DailyFocusTime[]> {
    if (playerIds.length === 0) return [];

    const today = this.getTodayDateString();
    return this.focusTimeRepository.find({
      where: {
        player: { id: In(playerIds) },
        createdDate: today as unknown as Date,
      },
      relations: ['player'],
    });
  }

  async getFocusTime(
    playerId: number,
    date: string,
  ): Promise<DailyFocusTime | null> {
    const focusTime = await this.focusTimeRepository.findOne({
      where: {
        player: { id: playerId },
        createdDate: date as unknown as Date,
      },
    });

    if (!focusTime) {
      const emptyRecord = new DailyFocusTime();
      emptyRecord.totalFocusSeconds = 0;
      emptyRecord.status = FocusStatus.RESTING;
      emptyRecord.createdDate = date as unknown as Date;
      emptyRecord.lastFocusStartTime = null as unknown as Date;
      return emptyRecord;
    }

    return focusTime;
  }
}
