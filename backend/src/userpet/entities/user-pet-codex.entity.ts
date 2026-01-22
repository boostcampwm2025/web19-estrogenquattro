import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';
import { Pet } from './pet.entity';

@Entity('user_pet_codex')
export class UserPetCodex {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'player_id' })
  playerId: number;

  @Column({ type: 'int', name: 'pet_id' })
  petId: number;

  @CreateDateColumn({ name: 'acquired_at' })
  acquiredAt: Date;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @ManyToOne(() => Pet)
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;
}
