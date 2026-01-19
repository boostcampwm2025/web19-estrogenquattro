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

@Injectable()
export class PetService {
  constructor(
    @InjectRepository(Pet)
    private readonly petRepository: Repository<Pet>,
    @InjectRepository(UserPet)
    private readonly userPetRepository: Repository<UserPet>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly dataSource: DataSource,
  ) {}

  async gacha(playerId: number): Promise<UserPet> {
    const GACHA_COST = 100;

    return this.dataSource.transaction(async (manager) => {
      // 1. 플레이어 포인트 확인 및 차감
      const player = await manager.findOne(Player, {
        where: { id: playerId },
        lock: { mode: 'pessimistic_write' },
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

      // 3. UserPet 생성
      const userPet = this.userPetRepository.create({
        player,
        pet: selectedPet,
        exp: 0,
      });

      return manager.save(UserPet, userPet);
    });
  }

  async feed(userPetId: string) {
    // TODO: Implement feed logic
    return 'feed result';
  }

  async evolve(userPetId: string) {
    // TODO: Implement evolve logic
    return 'evolve result';
  }
}
