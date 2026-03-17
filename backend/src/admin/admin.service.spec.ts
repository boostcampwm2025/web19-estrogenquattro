import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Admin } from './entities/admin.entity';
import { Ban } from './entities/ban.entity';

describe('AdminService', () => {
  let service: AdminService;

  const mockAdminRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBanRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(Admin),
          useValue: mockAdminRepository,
        },
        {
          provide: getRepositoryToken(Ban),
          useValue: mockBanRepository,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateAdmin', () => {
    it('admins 테이블에 playerId가 존재하면 예외 없이 통과한다', async () => {
      mockAdminRepository.findOne.mockResolvedValue({ playerId: 1 });
      await expect(service.validateAdmin(1)).resolves.toBeUndefined();
    });

    it('admins 테이블에 playerId가 없으면 ForbiddenException을 던진다', async () => {
      mockAdminRepository.findOne.mockResolvedValue(null);
      await expect(service.validateAdmin(99999)).rejects.toThrow(ForbiddenException);
    });
  });

  // Adding very basic coverage for ban/unban since they were recently modified
  describe('ban', () => {
    it('should save and return a new ban record', async () => {
      const mockBanDto = { targetPlayerId: 2, reason: 'test', duration: null };
      const createdBan = { id: 1, ...mockBanDto, bannedBy: { id: 1 }, targetPlayer: { id: 2 } };
      
      mockBanRepository.create.mockReturnValue(createdBan);
      mockBanRepository.save.mockResolvedValue(createdBan);

      const result = await service.ban(1, mockBanDto);
      expect(mockBanRepository.create).toHaveBeenCalled();
      expect(mockBanRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdBan);
    });
  });

  describe('unban', () => {
    it('should delete a ban record for a given player', async () => {
      mockBanRepository.delete.mockResolvedValue({ affected: 1 });
      await service.unban(2);
      expect(mockBanRepository.delete).toHaveBeenCalledWith({
        targetPlayer: { id: 2 },
      });
    });

    it('should throw NotFoundException if no ban record to delete', async () => {
      mockBanRepository.delete.mockResolvedValue({ affected: 0 });
      await expect(service.unban(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('isBanned', () => {
    it('should return true if ban exists', async () => {
      mockBanRepository.findOne.mockResolvedValue({ id: 1 });
      const result = await service.isBanned(2);
      expect(result).toBe(true);
    });

    it('should return false if ban does not exist', async () => {
      mockBanRepository.findOne.mockResolvedValue(null);
      const result = await service.isBanned(99);
      expect(result).toBe(false);
    });
  });
});
