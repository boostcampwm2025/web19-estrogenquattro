import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

export enum GithubActivityType {
  ISSUE_OPEN = 'ISSUE_OPEN',
  PR_OPEN = 'PR_OPEN',
  PR_MERGED = 'PR_MERGED',
  PR_REVIEWED = 'PR_REVIEWED',
  COMMITTED = 'COMMITTED',
}

@Entity('daily_github_activity')
export class DailyGithubActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'simple-enum', enum: GithubActivityType })
  type: GithubActivityType;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}