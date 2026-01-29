import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

export enum PointType {
  ISSUE_OPEN = 'ISSUE_OPEN',
  PR_OPEN = 'PR_OPEN',
  PR_MERGED = 'PR_MERGED',
  PR_REVIEWED = 'PR_REVIEWED',
  COMMITTED = 'COMMITTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  FOCUSED = 'FOCUSED',
}

@Entity('point_history')
export class PointHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ type: 'simple-enum', enum: PointType })
  type: PointType;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  repository: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'activity_at', type: 'datetime', nullable: true })
  activityAt: Date | null;

  @BeforeInsert()
  setCreatedDate(): void {
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
  }
}
