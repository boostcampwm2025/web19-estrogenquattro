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
import { BanCacheService } from './ban-cache.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(Ban)
    private readonly banRepository: Repository<Ban>,
    private readonly banCacheService: BanCacheService,
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

  async ban(adminId: number, dto: CreateBanDto): Promise<Ban> {
    const existingBan = await this.isBanned(dto.targetPlayerId);
    if (existingBan) {
      throw new ConflictException('이미 밴된 사용자입니다');
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

    const savedBan = await this.banRepository.save(ban);
    this.banCacheService.addBan(dto.targetPlayerId); // 캐시 업데이트

    return savedBan;
  }

  async isBanned(playerId: number): Promise<boolean> {
    const ban = await this.banRepository.findOne({
      where: { targetPlayer: { id: playerId } as unknown as Player },
    });
    return !!ban;
  }

  async unban(playerId: number): Promise<void> {
    const result = await this.banRepository.delete({
      targetPlayer: { id: playerId } as unknown as Player,
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Player with ID ${playerId} is not banned`);
    }

    this.banCacheService.removeBan(playerId); // 캐시 업데이트
    this.logger.log('User unbanned', { playerId });
  }
}
