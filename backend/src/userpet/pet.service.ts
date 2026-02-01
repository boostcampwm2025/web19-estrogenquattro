import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WriteLockService } from '../database/write-lock.service';
import { Pet } from './entities/pet.entity';
import { UserPet } from './entities/user-pet.entity';
import { Player } from '../player/entites/player.entity';
import { UserPetCodex } from './entities/user-pet-codex.entity';

@Injectable()
export class PetService {
  private readonly logger = new Logger(PetService.name);

  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(UserPet)
    private readonly userPetRepository: Repository<UserPet>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(UserPetCodex)
    private readonly userPetCodexRepository: Repository<UserPetCodex>,
    private readonly dataSource: DataSource,
    private readonly writeLock: WriteLockService,
  ) {}

  async gacha(
    playerId: number,
  ): Promise<{ userPet: UserPet; isDuplicate: boolean }> {
    const GACHA_COST = 100;
    this.logger.log(`[TX START] gacha - playerId: ${playerId}`);
    return this.writeLock
      .runExclusive(() =>
        this.dataSource.transaction(async (manager) => {
          this.logger.log(`[TX ACTIVE] gacha - playerId: ${playerId}`);
          // 1. 플레이어 포인트 확인 및 즉시 차감
          const player = await manager.findOne(Player, {
            where: { id: playerId },
          });

          if (!player) {
            throw new NotFoundException('Player not found');
          }

          if (player.totalPoint < GACHA_COST) {
            throw new BadRequestException('Not enough points');
          }

          player.totalPoint -= GACHA_COST;
          await manager.save(player);

          // 2. 랜덤 펫 선택 (Stage 1 펫 중에서)
          const stage1Pets = await manager.getRepository(Pet).find({
            where: { evolutionStage: 1 },
          });
          if (stage1Pets.length === 0) {
            throw new InternalServerErrorException('No stage 1 pets available');
          }

          const randomIndex = Math.floor(Math.random() * stage1Pets.length);
          const selectedPet = stage1Pets[randomIndex];

          // 3. 도감(Codex)에서 확인 (이미 수집한 이력이 있는지)
          const existingCodex = await manager
            .getRepository(UserPetCodex)
            .findOne({
              where: { playerId: player.id, petId: selectedPet.id },
            });

          if (existingCodex) {
            // 중복 펫 - 환급은 애니메이션 후 별도 API로 처리
            const dummyUserPet = new UserPet();
            dummyUserPet.id = -1; // 저장되지 않음을 의미
            dummyUserPet.pet = selectedPet;
            dummyUserPet.player = player;
            dummyUserPet.exp = 0;
            return { userPet: dummyUserPet, isDuplicate: true };
          }

          // 4. UserPet 생성 (미보유 시)
          const userPet = manager.getRepository(UserPet).create({
            player,
            pet: selectedPet,
            exp: 0,
          });

          // 5. 도감(Codex)에 등록
          const codex = manager.getRepository(UserPetCodex).create({
            player,
            pet: selectedPet,
          });
          await manager.save(UserPetCodex, codex);

          const savedUserPet = await manager.save(UserPet, userPet);
          this.logger.log(`[TX END] gacha - playerId: ${playerId}`);
          return { userPet: savedUserPet, isDuplicate: false };
        }),
      )
      .finally(() => {
        this.logger.log(`[TX COMPLETE] gacha - playerId: ${playerId}`);
      });
  }

  async refundGachaCost(
    playerId: number,
  ): Promise<{ refundAmount: number; totalPoint: number }> {
    const GACHA_COST = 100;
    const refundAmount = Math.floor(GACHA_COST / 2);
    this.logger.log(`[TX START] refundGachaCost - playerId: ${playerId}`);
    return this.writeLock
      .runExclusive(() =>
        this.dataSource.transaction(async (manager) => {
          this.logger.log(
            `[TX ACTIVE] refundGachaCost - playerId: ${playerId}`,
          );
          const player = await manager.findOne(Player, {
            where: { id: playerId },
          });

          if (!player) {
            throw new NotFoundException('Player not found');
          }

          player.totalPoint += refundAmount;
          await manager.save(player);
          this.logger.log(`[TX END] refundGachaCost - playerId: ${playerId}`);
          return { refundAmount, totalPoint: player.totalPoint };
        }),
      )
      .finally(() => {
        this.logger.log(
          `[TX COMPLETE] refundGachaCost - playerId: ${playerId}`,
        );
      });
  }

  async feed(userPetId: number, playerId: number): Promise<UserPet> {
    const FEED_COST = 10;
    const GAIN_EXP = 10;
    this.logger.log(
      `[TX START] feed - userPetId: ${userPetId}, playerId: ${playerId}`,
    );
    return this.writeLock
      .runExclusive(() =>
        this.dataSource.transaction(async (manager) => {
          this.logger.log(
            `[TX ACTIVE] feed - userPetId: ${userPetId}, playerId: ${playerId}`,
          );
          const userPet = await manager.findOne(UserPet, {
            where: { id: userPetId },
            relations: ['pet', 'player'],
          });

          if (!userPet) throw new NotFoundException('UserPet not found');
          if (userPet.playerId !== playerId)
            throw new BadRequestException('Not your pet');

          const { player, pet } = userPet;

          // 만렙 체크 (evolution_required_exp가 0이면 만렙으로 간주)
          if (pet.evolutionRequiredExp === 0) {
            throw new BadRequestException('Pet is already at max level');
          }

          // 포인트 차감
          if (player.totalPoint < FEED_COST) {
            throw new BadRequestException('Not enough points');
          }

          player.totalPoint -= FEED_COST;
          await manager.save(player);

          // 경험치 증가
          userPet.exp = Math.min(
            userPet.exp + GAIN_EXP,
            pet.evolutionRequiredExp,
          );
          const result = await manager.save(UserPet, userPet);
          this.logger.log(
            `[TX END] feed - userPetId: ${userPetId}, playerId: ${playerId}`,
          );
          return result;
        }),
      )
      .finally(() => {
        this.logger.log(
          `[TX COMPLETE] feed - userPetId: ${userPetId}, playerId: ${playerId}`,
        );
      });
  }

  async evolve(userPetId: number, playerId: number): Promise<UserPet> {
    this.logger.log(
      `[TX START] evolve - userPetId: ${userPetId}, playerId: ${playerId}`,
    );
    return this.writeLock
      .runExclusive(() =>
        this.dataSource.transaction(async (manager) => {
          this.logger.log(
            `[TX ACTIVE] evolve - userPetId: ${userPetId}, playerId: ${playerId}`,
          );
          const userPet = await manager.findOne(UserPet, {
            where: { id: userPetId },
            relations: ['pet', 'player'],
          });

          if (!userPet) throw new NotFoundException('UserPet not found');
          if (userPet.playerId !== playerId)
            throw new BadRequestException('Not your pet');

          const { pet: currentPet, player } = userPet;

          // 진화 조건 체크
          if (currentPet.evolutionRequiredExp === 0) {
            throw new BadRequestException('Already max stage');
          }

          if (userPet.exp < currentPet.evolutionRequiredExp) {
            throw new BadRequestException('Not enough experience to evolve');
          }

          // 다음 단계 펫 찾기 (같은 종족, 다음 스테이지)
          const nextStagePet = await manager.getRepository(Pet).findOne({
            where: {
              species: currentPet.species,
              evolutionStage: currentPet.evolutionStage + 1,
            },
          });

          if (!nextStagePet) {
            throw new InternalServerErrorException('Next evolution not found');
          }

          // 펫 정보 업데이트 (새 펫으로 교체, 경험치 초기화)
          userPet.pet = nextStagePet;
          userPet.exp = 0;

          // 도감(Codex)에 등록 (이미 있으면 무시)
          const existingCodex = await manager.findOne(UserPetCodex, {
            where: { playerId: player.id, petId: nextStagePet.id },
          });

          if (!existingCodex) {
            const codex = manager.getRepository(UserPetCodex).create({
              player,
              pet: nextStagePet,
            });
            await manager.save(UserPetCodex, codex);
          }

          const result = await manager.save(UserPet, userPet);
          this.logger.log(
            `[TX END] evolve - userPetId: ${userPetId}, playerId: ${playerId}`,
          );
          return result;
        }),
      )
      .finally(() => {
        this.logger.log(
          `[TX COMPLETE] evolve - userPetId: ${userPetId}, playerId: ${playerId}`,
        );
      });
  }

  async equipPet(petId: number, playerId: number): Promise<void> {
    const pet = await this.petRepository.findOne({ where: { id: petId } });
    if (!pet) throw new NotFoundException('Pet not found');

    // 1. 도감에 있는지 확인 (수집한 적이 있어야 장착 가능)
    const codex = await this.userPetCodexRepository.findOne({
      where: { playerId, petId },
    });

    if (!codex) {
      throw new BadRequestException('You do not own this pet');
    }

    // 2. 플레이어 정보 업데이트
    await this.playerRepository.update(playerId, { equippedPetId: petId });
  }

  async getInventory(playerId: number): Promise<UserPet[]> {
    return this.userPetRepository.find({
      where: { playerId },
      relations: ['pet'],
    });
  }

  async getCodex(playerId: number): Promise<number[]> {
    const codex = await this.userPetCodexRepository.find({
      where: { playerId },
      select: ['petId'],
    });
    return codex.map((c) => c.petId);
  }

  async getAllPets(): Promise<Pet[]> {
    return this.petRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }
}
