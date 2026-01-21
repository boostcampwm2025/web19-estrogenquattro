import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { UserPet } from './entities/user-pet.entity';
import { Player } from '../player/entites/player.entity';
import { PetService } from './pet.service';
import { UserPetCodex } from './entities/user-pet-codex.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pet, UserPet, Player, UserPetCodex])],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
