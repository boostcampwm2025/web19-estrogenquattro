import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', name: 'social_id', unique: true, nullable: false })
  socialId: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  nickname: string;

  @Column({ type: 'bigint', name: 'primary_user_pet_id', nullable: true })
  primaryUserPetId: string;

  @Column({ type: 'int', name: 'total_point', default: 0 })
  totalPoint: number;
}
