import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ type: 'varchar', length: 100, nullable: false })
  description: string;

  @Column({ type: 'int', name: 'total_focus_seconds', default: 0 })
  totalFocusSeconds: number;

  @Column({ type: 'datetime', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
