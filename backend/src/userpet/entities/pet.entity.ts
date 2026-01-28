import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserPet } from './user-pet.entity';

@Entity('pets')
export class Pet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  species: string;

  @Column({ type: 'int', name: 'evolution_stage' })
  evolutionStage: number;

  @Column({ type: 'int', name: 'evolution_required_exp' })
  evolutionRequiredExp: number;

  @Column({ type: 'varchar', length: 100, name: 'actual_img_url' })
  actualImgUrl: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'silhouette_img_url',
  })
  silhouetteImgUrl: string;

  @OneToMany(() => UserPet, (userPet) => userPet.pet)
  userPets: UserPet[];
}
