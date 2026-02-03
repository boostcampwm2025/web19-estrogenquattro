import type { PetEntity, UserPetEntity, PlayerEntity } from "../shared/pet";

type PetOverrides = Partial<PetEntity>;
type UserPetOverrides = Partial<UserPetEntity>;
type PlayerOverrides = Partial<PlayerEntity>;

let petIdCounter = 1;
let userPetIdCounter = 1;

export const buildPetEntity = (overrides: PetOverrides = {}): PetEntity => {
  const id = overrides.id ?? petIdCounter++;
  const base: PetEntity = {
    id,
    species: "gopher",
    name: `고퍼 ${id}`,
    description: "테스트 고퍼입니다",
    evolutionStage: 1,
    evolutionRequiredExp: 100,
    actualImgUrl: `/assets/mascot/gopher_stage1.webp`,
    silhouetteImgUrl: `/api/pets/silhouette/1`,
  };

  return { ...base, ...overrides };
};

export const buildUserPetEntity = (
  overrides: UserPetOverrides = {},
): UserPetEntity => {
  const id = overrides.id ?? userPetIdCounter++;
  const pet = overrides.pet ?? buildPetEntity();
  const base: UserPetEntity = {
    id,
    exp: 0,
    pet,
  };

  return { ...base, ...overrides };
};

export const buildPlayerEntity = (
  overrides: PlayerOverrides = {},
): PlayerEntity => {
  const base: PlayerEntity = {
    id: 1,
    socialId: 12345,
    nickname: "테스트유저",
    equippedPetId: null,
    totalPoint: 1000,
  };

  return { ...base, ...overrides };
};

export const resetPetFactoryCounters = () => {
  petIdCounter = 1;
  userPetIdCounter = 1;
};
