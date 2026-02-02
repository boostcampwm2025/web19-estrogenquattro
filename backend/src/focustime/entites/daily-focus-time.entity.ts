import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';
import { Task } from '../../task/entites/task.entity';

export enum FocusStatus {
  FOCUSING = 'FOCUSING',
  RESTING = 'RESTING',
}

@Entity('daily_focus_time')
export class DailyFocusTime {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'total_focus_seconds', type: 'int', default: 0 })
  totalFocusSeconds: number;

  /**
   * @deprecated V2에서 player.lastFocusStartTime으로 이동.
   * 집중 상태 판단은 player.lastFocusStartTime != null 로 대체.
   */
  @Column({
    type: 'simple-enum',
    enum: FocusStatus,
    default: FocusStatus.RESTING,
  })
  status: FocusStatus;

  @Column({ name: 'created_at', type: 'datetime', nullable: false })
  createdAt: Date;

  /**
   * @deprecated V2에서 player.lastFocusStartTime으로 이동.
   */
  @Column({ name: 'last_focus_start_time', type: 'datetime', nullable: true })
  lastFocusStartTime: Date;

  /**
   * @deprecated V2에서 player.focusingTaskId로 이동.
   */
  @Column({ name: 'current_task_id', type: 'int', nullable: true })
  currentTaskId: number | null;

  /**
   * @deprecated V2에서 player.focusingTaskId로 이동.
   */
  @ManyToOne(() => Task, { nullable: true })
  @JoinColumn({ name: 'current_task_id' })
  currentTask: Task | null;
}
