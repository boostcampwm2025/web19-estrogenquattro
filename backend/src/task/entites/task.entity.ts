import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', name: 'player_id', nullable: true })
  playerId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  description: string;

  @Column({ type: 'int', name: 'duration_minutes', default: 0 })
  durationMinutes: number;

  @Column({ type: 'date', name: 'completed_date' })
  completedDate: Date;

  @Column({ type: 'date', name: 'created_date' })
  createdDate: Date;
}
