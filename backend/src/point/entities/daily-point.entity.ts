import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('daily_point')
export class DailyPoint {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'created_date', type: 'text' })
  createdDate: string;

  @BeforeInsert()
  setCreatedDate(): void {
    if (!this.createdDate) {
      this.createdDate = new Date().toISOString().slice(0, 10);
    }
  }
}
