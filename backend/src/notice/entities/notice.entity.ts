import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from '../../player/entites/player.entity';

@Entity('notice')
export class Notice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200, name: 'title_ko' })
  titleKo: string;

  @Column({ type: 'text', name: 'content_ko' })
  contentKo: string;

  @Column({ type: 'varchar', length: 200, name: 'title_en' })
  titleEn: string;

  @Column({ type: 'text', name: 'content_en' })
  contentEn: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'author_id' })
  author: Player;
}
