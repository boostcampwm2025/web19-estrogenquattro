import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserPet } from '../../userpet/entities/user-pet.entity';
import { Pet } from '../../userpet/entities/pet.entity';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', name: 'social_id', unique: true, nullable: false })
  socialId: number;

  @Column({ type: 'varchar', length: 20, nullable: false })
  nickname: string;

  @Column({ type: 'int', name: 'equipped_pet_id', nullable: true })
  equippedPetId: number;

  @Column({ type: 'int', name: 'total_point', default: 100 })
  totalPoint: number;

  @Column({ type: 'boolean', name: 'is_newbie', default: true })
  isNewbie: boolean;

  /**
   * 현재 집중 중인 Task ID (nullable, FK 아님 - 애플리케이션 레벨 검증)
   * null이면 글로벌 타이머 또는 휴식 상태
   */
  @Column({ type: 'int', name: 'focusing_task_id', nullable: true })
  focusingTaskId: number | null;

  /**
   * 마지막 집중 시작 시간 (nullable)
   * null이면 휴식 상태, 값이 있으면 집중 상태
   */
  @Column({ type: 'datetime', name: 'last_focus_start_time', nullable: true })
  lastFocusStartTime: Date | null;

  @ManyToOne(() => Pet, { nullable: true })
  @JoinColumn({ name: 'equipped_pet_id' })
  equippedPet: Pet | null;

  @OneToMany(() => UserPet, (userPet) => userPet.player)
  userPets: UserPet[];
}
