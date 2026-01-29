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

  @Column({ type: 'int', name: 'total_point', default: 0 })
  totalPoint: number;

  @Column({ type: 'boolean', name: 'is_newbie', default: true })
  isNewbie: boolean;

  @ManyToOne(() => Pet, { nullable: true })
  @JoinColumn({ name: 'equipped_pet_id' })
  equippedPet: Pet | null;

  @OneToMany(() => UserPet, (userPet) => userPet.player)
  userPets: UserPet[];
}
