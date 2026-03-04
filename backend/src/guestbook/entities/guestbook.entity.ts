import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('guestbooks')
@Unique(['player', 'writeDate'])
export class Guestbook {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  content: string;

  @Column({ name: 'write_date', type: 'varchar', length: 10 })
  writeDate: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
