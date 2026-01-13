import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: string;

  @ManyToOne(() => Player)
  player: Player;

  @Column({ type: 'varchar', length: 100, nullable: false })
  description: string;

  @Column({ type: 'int', name: 'duration_minutes', default: 0 })
  durationMinutes: number;

  @Column({ type: 'date', name: 'completed_date' })
  completedDate: Date;

  @Column({ type: 'date', name: 'created_date' })
  createdDate: Date;
}
