import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Admin } from './entities/admin.entity';

describe('AdminService', () => {
  let service: AdminService;
  let adminRepository: Repository<Admin>;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Admin],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Admin]),
      ],
      providers: [AdminService],
    }).compile();

    service = module.get<AdminService>(AdminService);
    adminRepository = module.get<Repository<Admin>>(getRepositoryToken(Admin));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await adminRepository.clear();
  });

  describe('validateAdmin', () => {
    it('admins 테이블에 playerId가 존재하면 예외 없이 통과한다', async () => {
      // Given
      const admin = adminRepository.create({ playerId: 1 });
      await adminRepository.save(admin);

      // When & Then
      await expect(service.validateAdmin(1)).resolves.toBeUndefined();
    });

    it('admins 테이블에 playerId가 없으면 ForbiddenException을 던진다', async () => {
      // Given
      const nonExistentPlayerId = 99999;

      // When & Then
      await expect(service.validateAdmin(nonExistentPlayerId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.validateAdmin(nonExistentPlayerId)).rejects.toThrow(
        '관리자 권한이 없습니다',
      );
    });
  });
});
