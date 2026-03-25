import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ban } from './entities/ban.entity';

@Injectable()
export class BanCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BanCacheService.name);

  // playerId -> 밴된 시점(timestamp)
  private bannedPlayers: Map<number, number> = new Map();

  // JWT 토큰 유효기간 (1일 = 24시간 = 86400000ms)
  private readonly JWT_EXPIRY_MS = 24 * 60 * 60 * 1000;

  private cleanupInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(Ban)
    private readonly banRepository: Repository<Ban>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing BanCacheService: Loading recent bans...');
    const bans = await this.banRepository.find({
      relations: ['targetPlayer'],
    });

    const now = Date.now();
    for (const ban of bans) {
      if (ban.targetPlayer?.id) {
        const banTime = ban.bannedAt.getTime();
        // 메모리에는 토큰 만료 기간이 지나지 않은 밴 기록만 올림
        if (now - banTime <= this.JWT_EXPIRY_MS) {
          this.bannedPlayers.set(ban.targetPlayer.id, banTime);
        }
      }
    }

    this.logger.log(
      `BanCacheService: Loaded ${this.bannedPlayers.size} recently banned players into memory.`,
    );

    // 1시간마다 만료된 밴 기록 메모리 청소
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredBans(),
      60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private cleanupExpiredBans() {
    const now = Date.now();
    let removedCount = 0;

    for (const [playerId, banTime] of this.bannedPlayers.entries()) {
      if (now - banTime > this.JWT_EXPIRY_MS) {
        this.bannedPlayers.delete(playerId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(
        `BanCacheService: Cleaned up ${removedCount} expired ban records from memory.`,
      );
    }
  }

  isBanned(playerId: number): boolean {
    const banTime = this.bannedPlayers.get(playerId);
    if (!banTime) return false;

    // 조회 시점에도 토큰 만료 시간이 지났다면 캐시를 지우고 false 처리
    // (어차피 토큰 자체가 만료되어 Guard를 통과하지 못합니다)
    if (Date.now() - banTime > this.JWT_EXPIRY_MS) {
      this.bannedPlayers.delete(playerId);
      return false;
    }

    return true;
  }

  addBan(playerId: number): void {
    // 밴한 시점을 기록
    this.bannedPlayers.set(playerId, Date.now());
  }

  removeBan(playerId: number): void {
    this.bannedPlayers.delete(playerId);
  }
}
