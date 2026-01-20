import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { petApi } from "@/lib/api/pet";

export const usePetSystem = () => {
  const queryClient = useQueryClient();

  // 인벤토리 조회 (내 펫 목록)
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["pets", "inventory"],
    queryFn: petApi.getInventory,
  });

  // 도감(Codex) 조회
  const { data: codex = [] } = useQuery({
    queryKey: ["pets", "codex"],
    queryFn: petApi.getCodex,
  });

  // 플레이어 정보 (장착 펫 확인용)
  const { data: player } = useQuery({
    queryKey: ["player", "me"],
    queryFn: petApi.getPlayer,
  });

  // 전체 펫 목록 (도감용)
  const { data: allPets = [] } = useQuery({
    queryKey: ["pets", "all"],
    queryFn: petApi.getAllPets,
    staleTime: 1000 * 60 * 60, // 1 hour (데이터가 잘 안 바뀌므로)
  });

  // 가챠
  const gachaMutation = useMutation({
    mutationFn: petApi.gacha,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pets", "codex"] });
    },
  });

  // 먹이주기
  const feedMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.feed(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets", "inventory"] });
    },
  });

  // 진화
  const evolveMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.evolve(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pets", "codex"] });
    },
  });

  // 대표 펫 장착
  const equipMutation = useMutation({
    mutationFn: (petId: number) => petApi.equipPet(petId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player", "me"] });
    },
  });

  return {
    inventory,
    codex,
    allPets,
    player,
    isLoading,
    gacha: gachaMutation.mutateAsync,
    feed: feedMutation.mutateAsync,
    evolve: evolveMutation.mutateAsync,
    equip: equipMutation.mutateAsync,
  };
};
