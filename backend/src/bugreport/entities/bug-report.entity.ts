import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('bug_reports')
export class BugReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
