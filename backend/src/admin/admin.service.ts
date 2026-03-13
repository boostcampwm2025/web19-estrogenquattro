import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
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
}
