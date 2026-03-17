import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WriteLockService } from '../database/write-lock.service';
import { PetService } from './pet.service';
import { Pet } from './entities/pet.entity';
import { UserPet } from './entities/user-pet.entity';
import { Player } from '../player/entites/player.entity';
import { UserPetCodex } from './entities/user-pet-codex.entity';

describe('PetService', () => {
  const createService = () => {
    const petRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<Pet>;
    const userPetRepository = {
      find: jest.fn(),
    } as unknown as Repository<UserPet>;
    const playerRepository = {
      update: jest.fn(),
    } as unknown as Repository<Player>;
    const userPetCodexRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<UserPetCodex>;
    const manager = {
      findOne: jest.fn(),
      getRepository: jest.fn(),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn().mockImplementation((callback) => callback(manager)),
    } as unknown as DataSource;
    const writeLock = {
      runExclusive: jest.fn().mockImplementation((callback) => callback()),
    } as unknown as WriteLockService;

    const service = new PetService(
      petRepository,
      userPetRepository,
      playerRepository,
      userPetCodexRepository,
      dataSource,
      writeLock,
    );

    return {
      service,
      petRepository,
      userPetRepository,
      playerRepository,
      userPetCodexRepository,
      manager,
    };
  };

  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('가챠 시 플레이어가 없으면 예외를 던진다', async () => {
    const { service, manager } = createService();
    (manager.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.gacha(1)).rejects.toThrow(NotFoundException);
  });

  it('가챠 포인트가 부족하면 예외를 던진다', async () => {
    const { service, manager } = createService();
    (manager.findOne as jest.Mock).mockResolvedValue({ id: 1, totalPoint: 99 });

    await expect(service.gacha(1)).rejects.toThrow(BadRequestException);
  });

  it('가챠 가능한 stage 1 펫이 없으면 예외를 던진다', async () => {
    const { service, manager } = createService();
    const player = { id: 1, totalPoint: 200 };
    const petRepo = { find: jest.fn().mockResolvedValue([]) };

    (manager.findOne as jest.Mock).mockResolvedValue(player);
    (manager.save as jest.Mock).mockResolvedValue(player);
    (manager.getRepository as jest.Mock).mockReturnValue(petRepo);

    await expect(service.gacha(1)).rejects.toThrow(InternalServerErrorException);
  });

  it('중복 펫이면 더미 userPet과 duplicate 플래그를 반환한다', async () => {
    const { service, manager } = createService();
    const player = { id: 1, totalPoint: 200 };
    const pet = { id: 10 };
    const petRepo = { find: jest.fn().mockResolvedValue([pet]) };
    const codexRepo = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };

    (manager.findOne as jest.Mock).mockResolvedValue(player);
    (manager.save as jest.Mock).mockResolvedValue(player);
    (manager.getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === Pet) return petRepo;
      if (entity === UserPetCodex) return codexRepo;
      return { create: jest.fn(), findOne: jest.fn() };
    });

    await expect(service.gacha(1)).resolves.toMatchObject({
      isDuplicate: true,
      userPet: { id: -1, pet },
    });
  });

  it('새 펫이면 도감과 userPet을 저장한다', async () => {
    const { service, manager } = createService();
    const player = { id: 1, totalPoint: 200 };
    const pet = { id: 10 };
    const userPet = { id: 3, pet, player, exp: 0 };
    const petRepo = { find: jest.fn().mockResolvedValue([pet]) };
    const codexRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({ player, pet }),
    };
    const userPetRepo = {
      create: jest.fn().mockReturnValue(userPet),
    };

    (manager.findOne as jest.Mock).mockResolvedValue(player);
    (manager.save as jest.Mock)
      .mockResolvedValueOnce(player)
      .mockResolvedValueOnce({ player, pet })
      .mockResolvedValueOnce(userPet);
    (manager.getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === Pet) return petRepo;
      if (entity === UserPetCodex) return codexRepo;
      if (entity === UserPet) return userPetRepo;
      return null;
    });

    await expect(service.gacha(1)).resolves.toEqual({
      userPet,
      isDuplicate: false,
    });
  });

  it('가챠 환급은 포인트를 절반만 돌려준다', async () => {
    const { service, manager } = createService();
    const player = { id: 1, totalPoint: 50 };
    (manager.findOne as jest.Mock).mockResolvedValue(player);
    (manager.save as jest.Mock).mockResolvedValue(player);

    await expect(service.refundGachaCost(1)).resolves.toEqual({
      refundAmount: 50,
      totalPoint: 100,
    });
  });

  it('먹이주기는 소유권과 포인트를 검증하고 경험치를 올린다', async () => {
    const { service, manager } = createService();
    const userPet = {
      id: 1,
      playerId: 1,
      exp: 15,
      player: { id: 1, totalPoint: 20 },
      pet: { evolutionRequiredExp: 20 },
    };

    (manager.findOne as jest.Mock).mockResolvedValue(userPet);
    (manager.save as jest.Mock)
      .mockResolvedValueOnce(userPet.player)
      .mockResolvedValueOnce({ ...userPet, exp: 20 });

    await expect(service.feed(1, 1)).resolves.toMatchObject({ exp: 20 });
  });

  it('먹이주기는 만렙, 포인트 부족, 타인 펫 조건에서 실패한다', async () => {
    const { service, manager } = createService();

    (manager.findOne as jest.Mock).mockResolvedValueOnce({
      playerId: 2,
      player: { id: 2, totalPoint: 100 },
      pet: { evolutionRequiredExp: 10 },
    });
    await expect(service.feed(1, 1)).rejects.toThrow(BadRequestException);

    (manager.findOne as jest.Mock).mockResolvedValueOnce({
      playerId: 1,
      player: { id: 1, totalPoint: 100 },
      pet: { evolutionRequiredExp: 0 },
    });
    await expect(service.feed(1, 1)).rejects.toThrow(BadRequestException);

    (manager.findOne as jest.Mock).mockResolvedValueOnce({
      playerId: 1,
      player: { id: 1, totalPoint: 5 },
      pet: { evolutionRequiredExp: 20 },
    });
    await expect(service.feed(1, 1)).rejects.toThrow(BadRequestException);
  });

  it('진화는 경험치와 다음 단계 펫을 검증한다', async () => {
    const { service, manager } = createService();
    const userPet = {
      id: 1,
      playerId: 1,
      exp: 20,
      player: { id: 1 },
      pet: { id: 10, species: 'cat', evolutionStage: 1, evolutionRequiredExp: 20 },
    };
    const nextPet = { id: 11 };
    const petRepo = { findOne: jest.fn().mockResolvedValue(nextPet) };

    (manager.findOne as jest.Mock)
      .mockResolvedValueOnce(userPet)
      .mockResolvedValueOnce(null);
    (manager.getRepository as jest.Mock).mockImplementation((entity) => {
      if (entity === Pet) return petRepo;
      if (entity === UserPetCodex) {
        return { create: jest.fn().mockReturnValue({ player: userPet.player, pet: nextPet }) };
      }
      return null;
    });
    (manager.save as jest.Mock)
      .mockResolvedValueOnce({ player: userPet.player, pet: nextPet })
      .mockResolvedValueOnce({ ...userPet, pet: nextPet, exp: 0 });

    await expect(service.evolve(1, 1)).resolves.toMatchObject({
      pet: nextPet,
      exp: 0,
    });
  });

  it('진화는 조건이 맞지 않으면 실패한다', async () => {
    const { service, manager } = createService();

    (manager.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.evolve(1, 1)).rejects.toThrow(NotFoundException);

    (manager.findOne as jest.Mock).mockResolvedValueOnce({
      playerId: 2,
      player: { id: 2 },
      pet: { evolutionRequiredExp: 10 },
      exp: 10,
    });
    await expect(service.evolve(1, 1)).rejects.toThrow(BadRequestException);

    (manager.findOne as jest.Mock).mockResolvedValueOnce({
      playerId: 1,
      player: { id: 1 },
      pet: { evolutionRequiredExp: 0 },
      exp: 10,
    });
    await expect(service.evolve(1, 1)).rejects.toThrow(BadRequestException);

    (manager.findOne as jest.Mock).mockResolvedValueOnce({
      playerId: 1,
      player: { id: 1 },
      pet: { evolutionRequiredExp: 20 },
      exp: 10,
    });
    await expect(service.evolve(1, 1)).rejects.toThrow(BadRequestException);
  });

  it('장착과 조회 메서드는 저장소를 그대로 사용한다', async () => {
    const {
      service,
      petRepository,
      playerRepository,
      userPetCodexRepository,
      userPetRepository,
    } = createService();

    (petRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.equipPet(1, 1)).rejects.toThrow(NotFoundException);

    (petRepository.findOne as jest.Mock).mockResolvedValueOnce({ id: 1 });
    (userPetCodexRepository.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.equipPet(1, 1)).rejects.toThrow(BadRequestException);

    (petRepository.findOne as jest.Mock).mockResolvedValueOnce({ id: 1 });
    (userPetCodexRepository.findOne as jest.Mock).mockResolvedValueOnce({ id: 2 });
    await service.equipPet(1, 1);
    expect(playerRepository.update).toHaveBeenCalledWith(1, { equippedPetId: 1 });

    (userPetRepository.find as jest.Mock).mockResolvedValue([{ id: 1 }]);
    await expect(service.getInventory(1)).resolves.toEqual([{ id: 1 }]);

    (userPetCodexRepository.find as jest.Mock).mockResolvedValue([
      { petId: 3 },
      { petId: 4 },
    ]);
    await expect(service.getCodex(1)).resolves.toEqual([3, 4]);

    (petRepository.find as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
    await expect(service.getAllPets()).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });
});
