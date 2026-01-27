import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Pet } from './entities/pet.entity';
import { UserPet } from './entities/user-pet.entity';
import { Player } from '../player/entites/player.entity';
import { UserPetCodex } from './entities/user-pet-codex.entity';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class PetService {
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
  ) {}

  async gacha(playerId: number): Promise<UserPet> {
    const GACHA_COST = 0;

    return this.dataSource.transaction(async (manager) => {
      // 1. 플레이어 포인트 확인 및 차감
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
      const stage1Pets = await this.petRepository.find({
        where: { evolutionStage: 1 },
      });
      if (stage1Pets.length === 0) {
        throw new InternalServerErrorException('No stage 1 pets available');
      }

      const randomIndex = Math.floor(Math.random() * stage1Pets.length);
      const selectedPet = stage1Pets[randomIndex];

      // 3. 도감(Codex)에서 확인 (이미 수집한 이력이 있는지)
      const existingCodex = await this.userPetCodexRepository.findOne({
        where: { playerId: player.id, petId: selectedPet.id },
      });

      if (existingCodex) {
        const dummyUserPet = new UserPet();
        dummyUserPet.id = -1; // 저장되지 않음을 의미
        dummyUserPet.pet = selectedPet;
        dummyUserPet.player = player;
        dummyUserPet.exp = 0;
        return dummyUserPet;
      }

      // 4. UserPet 생성 (미보유 시)
      const userPet = this.userPetRepository.create({
        player,
        pet: selectedPet,
        exp: 0,
      });

      // 5. 도감(Codex)에 등록
      // 위에서 이미 검사했으므로 여기서는 무조건 없음 -> 생성
      const codex = this.userPetCodexRepository.create({
        player,
        pet: selectedPet,
      });
      await manager.save(UserPetCodex, codex);

      return manager.save(UserPet, userPet);
    });
  }

  async feed(userPetId: number, playerId: number): Promise<UserPet> {
    const FEED_COST = 0;
    const GAIN_EXP = 10;

    return this.dataSource.transaction(async (manager) => {
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
      userPet.exp = Math.min(userPet.exp + GAIN_EXP, pet.evolutionRequiredExp);
      return manager.save(UserPet, userPet);
    });
  }

  async evolve(userPetId: number, playerId: number): Promise<UserPet> {
    return this.dataSource.transaction(async (manager) => {
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
      const nextStagePet = await this.petRepository.findOne({
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
        const codex = this.userPetCodexRepository.create({
          player,
          pet: nextStagePet,
        });
        await manager.save(UserPetCodex, codex);
      }

      return manager.save(UserPet, userPet);
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

  async getSilhouette(petId: number): Promise<Buffer> {
    const pet = await this.petRepository.findOne({ where: { id: petId } });
    if (!pet) throw new NotFoundException('Pet not found');

    const cacheDir = path.join(process.cwd(), 'public/cache/silhouettes');
    const cachePath = path.join(cacheDir, `${petId}.png`);

    // 1. 캐시 확인
    try {
      return await fs.readFile(cachePath);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code !== 'ENOENT') throw error;
      // 캐시가 없으면(ENOENT) 다음 단계로 진행
    }

    // 2. 캐시 디렉토리 생성 확인
    try {
      await fs.access(cacheDir);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        await fs.mkdir(cacheDir, { recursive: true });
      } else {
        throw error;
      }
    }

    // 3. 원본 이미지 경로 확인
    const publicDir = path.join(process.cwd(), 'public');
    const originalPath = path.join(
      publicDir,
      pet.actualImgUrl.startsWith('/')
        ? pet.actualImgUrl.substring(1)
        : pet.actualImgUrl,
    );

    // 경로 탐색 공격 방지: 최종 경로가 public 디렉토리 내에 있는지 검증
    const resolvedPath = path.resolve(originalPath);
    if (!resolvedPath.startsWith(path.resolve(publicDir))) {
      throw new BadRequestException('Invalid image path');
    }

    try {
      await fs.access(originalPath);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        console.error(`Original image not found at ${originalPath}`);
        throw new NotFoundException(`Original image not found`);
      }
      throw error;
    }

    // 4. 실루엣 생성 (sharp 사용)
    const metadata = await sharp(originalPath).metadata();
    const finalBuffer = await sharp({
      create: {
        width: metadata.width || 128,
        height: metadata.height || 128,
        channels: 4,
        background: { r: 64, g: 64, b: 64, alpha: 0.4 },
      },
    })
      .composite([
        {
          input: originalPath,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();

    // 5. 캐시에 저장
    await fs.writeFile(cachePath, finalBuffer);

    return finalBuffer;
  }
}
