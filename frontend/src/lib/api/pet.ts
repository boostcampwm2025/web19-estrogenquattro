import { fetchApi } from "./client";

// Pet API Interfaces
export interface Pet {
  id: number;
  species: string;
  name: string;
  description: string;
  evolutionStage: number;
  evolutionRequiredExp: number;
  actualImgUrl: string;
}

export interface UserPet {
  id: number;
  exp: number;
  pet: Pet;
  // player: Player; // 필요 시 추가
}

export interface PlayerInfoResponse {
  id: number;
  socialId: number;
  nickname: string;
  equippedPetId: number | null;
  totalPoint: number;
}

export const petApi = {
  getInventory: (playerId: number) =>
    fetchApi<UserPet[]>(`/api/pets/inventory/${playerId}`),

  gacha: () =>
    fetchApi<UserPet>("/api/pets/gacha", {
      method: "POST",
    }),

  feed: (userPetId: number) =>
    fetchApi<UserPet>("/api/pets/feed", {
      method: "POST",
      body: JSON.stringify({ userPetId }),
    }),

  evolve: (userPetId: number) =>
    fetchApi<UserPet>("/api/pets/evolve", {
      method: "POST",
      body: JSON.stringify({ userPetId }),
    }),

  equipPet: (petId: number) =>
    fetchApi<{ success: boolean }>("/api/players/me/equipped-pet", {
      method: "PATCH",
      body: JSON.stringify({ petId }),
    }),

  getCodex: (playerId: number) =>
    fetchApi<number[]>(`/api/pets/codex/${playerId}`),

  getAllPets: () => fetchApi<Pet[]>("/api/pets/all"),

  //임시로 설정해 둠 -> 추후 player api로 변경예정
  getPlayer: () => fetchApi<PlayerInfoResponse>("/api/players/me/info"),
};
