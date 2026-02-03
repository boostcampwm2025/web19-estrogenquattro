import type { Pet, UserPet, PlayerInfoResponse } from "../../src/lib/api/pet";

export type PetEntity = Pet;
export type UserPetEntity = UserPet;
export type PlayerEntity = PlayerInfoResponse;

export const toPetRes = (pet: PetEntity): Pet => ({ ...pet });
export const toUserPetRes = (userPet: UserPetEntity): UserPet => ({
  ...userPet,
});
export const toPlayerRes = (player: PlayerEntity): PlayerInfoResponse => ({
  ...player,
});
