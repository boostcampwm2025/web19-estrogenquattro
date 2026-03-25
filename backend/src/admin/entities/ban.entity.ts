import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('bans')
export class Ban {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'banned_at', type: 'datetime' })
  bannedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'target_player_id' })
  targetPlayer: Player;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'banned_by_id' })
  bannedBy: Player;
}
