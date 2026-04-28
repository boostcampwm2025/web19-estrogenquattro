import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('chat_messages')
export class ChatHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'room_id', type: 'varchar', length: 50 })
  roomId: string;

  @Column({ type: 'varchar', length: 20 })
  nickname: string;

  @Column({ type: 'varchar', length: 200 })
  message: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
