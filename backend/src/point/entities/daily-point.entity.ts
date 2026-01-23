import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('daily_point')
export class DailyPoint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'player_id', type: 'bigint' })
  playerId: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'created_date', type: 'date' })
  createdDate: string;
}
