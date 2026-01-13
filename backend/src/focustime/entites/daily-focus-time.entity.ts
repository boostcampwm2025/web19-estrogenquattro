import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

export enum FocusStatus {
  FOCUSING = 'FOCUSING',
  RESTING = 'RESTING',
}

@Entity('daily_focus_time')
export class DailyFocusTime {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'total_focus_minutes', type: 'int', default: 0 })
  totalFocusMinutes: number;

  @Column({
    type: 'simple-enum',
    enum: FocusStatus,
    default: FocusStatus.RESTING,
  })
  status: FocusStatus;

  @Column({ name: 'created_date', type: 'date', nullable: false })
  createdDate: Date;

  @Column({ name: 'last_focus_start_time', type: 'timestamp', nullable: true })
  lastFocusStartTime: Date;
}
