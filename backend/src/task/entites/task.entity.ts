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

  @Column({ type: 'date', name: 'completed_date', nullable: true })
  completedDate: string | null;

  @Column({ type: 'date', name: 'created_date' })
  createdDate: string;
}
