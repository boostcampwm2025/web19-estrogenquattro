import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async gacha(playerId: string) {
    // TODO: Implement gacha logic
    return 'gacha result';
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
