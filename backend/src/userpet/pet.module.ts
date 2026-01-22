import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { UserPet } from './entities/user-pet.entity';
import { Player } from '../player/entites/player.entity';
import { PetService } from './pet.service';
import { UserPetCodex } from './entities/user-pet-codex.entity';

import { PetController } from './pet.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pet, UserPet, Player, UserPetCodex])],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
