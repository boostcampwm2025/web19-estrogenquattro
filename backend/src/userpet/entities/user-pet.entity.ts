import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';
import { Pet } from './pet.entity';

@Entity('user_pets')
export class UserPet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'player_id' })
  playerId: number;

  @Column({ type: 'int', name: 'pet_id' })
  petId: number;

  @Column({ type: 'int', default: 0 })
  exp: number;

  @ManyToOne(() => Player, (player) => player.userPets)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @ManyToOne(() => Pet, (pet) => pet.userPets)
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;
}
