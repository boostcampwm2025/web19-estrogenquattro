import { PETS_DATA } from "../data/pets";

// 현재 대표펫의 진화 라인을 가져오는 헬퍼함수
export const getEvolutionLine = (petId: string) => {
  const targetPet = PETS_DATA.find((p) => p.id === petId);
  if (!targetPet) return [];

  return PETS_DATA.filter((p) => p.species === targetPet.species);
};
