import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('global_state')
export class GlobalState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'text', default: '{}' })
  contributions: string; // JSON string

  @Column({ name: 'map_index', type: 'int', default: 0 })
  mapIndex: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
