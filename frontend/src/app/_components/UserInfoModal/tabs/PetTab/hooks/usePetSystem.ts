import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { petApi } from "@/lib/api/pet";

export const usePetSystem = (playerId: number) => {
  const queryClient = useQueryClient();

  // 인벤토리 조회 (해당 유저의 펫 목록)
  const { data: inventory = [], isLoading: isInventoryLoading } = useQuery({
    queryKey: ["pets", "inventory", playerId],
    queryFn: () => petApi.getInventory(playerId),
  });

  // 도감(Codex) 조회
  const { data: codex = [], isLoading: isCodexLoading } = useQuery({
    queryKey: ["pets", "codex", playerId],
    queryFn: () => petApi.getCodex(playerId),
  });

  // 플레이어 정보 (장착 펫 확인용)
  const { data: player, isLoading: isPlayerLoading } = useQuery({
    queryKey: ["player", "me"],
    queryFn: petApi.getPlayer,
  });

  // 전체 펫 목록 (도감용)
  const { data: allPets = [], isLoading: isAllPetsLoading } = useQuery({
    queryKey: ["pets", "all"],
    queryFn: petApi.getAllPets,
    staleTime: 1000 * 60 * 60, // 1 hour (데이터가 잘 안 바뀌므로)
  });

  const isLoading =
    isInventoryLoading || isCodexLoading || isPlayerLoading || isAllPetsLoading;

  // 가챠
  const gachaMutation = useMutation({
    mutationFn: petApi.gacha,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets", "inventory", playerId] });
      queryClient.invalidateQueries({ queryKey: ["pets", "codex", playerId] });
      // 포인트 차감 동기화를 위해 플레이어 정보 갱신
      queryClient.invalidateQueries({ queryKey: ["player", "me"] });
    },
  });

  // 먹이주기
  const feedMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.feed(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets", "inventory", playerId] });
      // 포인트 차감 동기화를 위해 플레이어 정보 갱신
      queryClient.invalidateQueries({ queryKey: ["player", "me"] });
    },
  });

  // 진화
  const evolveMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.evolve(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets", "inventory", playerId] });
      queryClient.invalidateQueries({ queryKey: ["pets", "codex", playerId] });
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
