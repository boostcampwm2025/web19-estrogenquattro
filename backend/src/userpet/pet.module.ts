import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pet } from './entities/pet.entity';
import { UserPet } from './entities/user-pet.entity';
import { Player } from '../player/entites/player.entity';
import { PetService } from './pet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pet, UserPet, Player])],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
