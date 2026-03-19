import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';
import { Ban } from './entities/ban.entity';
import { CreateBanDto } from './dto/create-ban.dto';
import { Player } from '../player/entites/player.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(Ban)
    private readonly banRepository: Repository<Ban>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
  ) {}

  async validateAdmin(playerId: number): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { playerId },
    });

    if (!admin) {
      this.logger.warn('Unauthorized admin access attempt', { playerId });
      throw new ForbiddenException('관리자 권한이 없습니다');
    }

    this.logger.debug('Admin validated', { playerId });
  }

  private escapeLike(value: string): string {
    return value.replace(/[%_]/g, '\\$&');
  }

  async getPlayers(search?: string) {
    const query = this.playerRepository
      .createQueryBuilder('player')
      .select(['player.id', 'player.nickname', 'player.socialId', 'ban.reason'])
      .leftJoin('bans', 'ban', 'ban.target_player_id = player.id')
      .orderBy('player.id', 'ASC');

    if (search) {
      query.where('player.nickname LIKE :search', {
        search: `${this.escapeLike(search)}%`,
      });
    }

    const rows = await query.getRawMany<{
      player_id: number;
      player_nickname: string;
      ban_reason: string | null;
    }>();

    return rows.map((r) => ({
      id: r.player_id,
      nickname: r.player_nickname,
      isBanned: r.ban_reason !== null,
      banReason: r.ban_reason ?? null,
    }));
  }

  async ban(adminId: number, dto: CreateBanDto): Promise<Ban> {
    const existing = await this.banRepository.findOne({
      where: { targetPlayer: { id: dto.targetPlayerId } as unknown as Player },
    });

    if (existing) {
      throw new ConflictException(
        `Player with ID ${dto.targetPlayerId} is already banned`,
      );
    }

    const ban = this.banRepository.create({
      ...dto,
      targetPlayer: { id: dto.targetPlayerId } as unknown as Player,
      bannedBy: { id: adminId } as unknown as Player,
    });

    this.logger.log('User banned', {
      targetPlayerId: dto.targetPlayerId,
      bannedBy: adminId,
    });
    return this.banRepository.save(ban);
  }

  async getBan(
    playerId: number,
  ): Promise<{ isBanned: boolean; reason: string | null }> {
    const ban = await this.banRepository.findOne({
      where: { targetPlayer: { id: playerId } as unknown as Player },
    });
    return { isBanned: !!ban, reason: ban?.reason ?? null };
  }

  async unban(playerId: number): Promise<void> {
    const result = await this.banRepository.delete({
      targetPlayer: { id: playerId } as unknown as Player,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Player with ID ${playerId} is not banned`);
    }

    this.logger.log('User unbanned', { playerId });
  }
}
