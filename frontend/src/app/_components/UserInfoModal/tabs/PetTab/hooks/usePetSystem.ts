import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { petApi } from "@/lib/api/pet";
import { getSocket } from "@/lib/socket";

export const usePetSystem = (playerId: number) => {
  const queryClient = useQueryClient();

  // 인벤토리 조회 (해당 유저의 펫 목록)
  const { data: inventory = [], isLoading: isInventoryLoading } = useQuery({
    queryKey: ["pets", "inventory", playerId],
    queryFn: () => petApi.getInventory(playerId),
    enabled: !!playerId,
    staleTime: 0,
  });

  // 도감(Codex) 조회
  const { data: codex = [], isLoading: isCodexLoading } = useQuery({
    queryKey: ["pets", "codex", playerId],
    queryFn: () => petApi.getCodex(playerId),
    enabled: !!playerId,
    staleTime: 0,
  });

  // 플레이어 정보 (장착 펫 확인용)
  const { data: player, isLoading: isPlayerLoading } = useQuery({
    queryKey: ["player", "info", playerId],
    queryFn: () => petApi.getPlayer(playerId),
    enabled: !!playerId,
    staleTime: 0,
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
      queryClient.invalidateQueries({
        queryKey: ["pets", "inventory", playerId],
      });
      queryClient.invalidateQueries({ queryKey: ["pets", "codex", playerId] });
      // 포인트 차감 동기화를 위해 플레이어 정보 갱신
      queryClient.invalidateQueries({ queryKey: ["player", "info", playerId] });
    },
  });

  // 먹이주기
  const feedMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.feed(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["pets", "inventory", playerId],
      });
      // 포인트 차감 동기화를 위해 플레이어 정보 갱신
      queryClient.invalidateQueries({ queryKey: ["player", "info", playerId] });
    },
  });

  // 진화
  const evolveMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.evolve(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["pets", "inventory", playerId],
      });
      queryClient.invalidateQueries({ queryKey: ["pets", "codex", playerId] });
    },
  });

  // 대표 펫 장착
  const equipMutation = useMutation({
    mutationFn: (petId: number) => petApi.equipPet(petId),
    onSuccess: (_, petId) => {
      queryClient.invalidateQueries({ queryKey: ["player", "info", playerId] });

      // 1. 장착한 펫의 이미지 URL 찾기
      const targetPet = allPets.find((p) => p.id === petId);
      if (targetPet) {
        const petImage = targetPet.actualImgUrl;

        // 2. 소켓으로 전파 (다른 플레이어용)
        const socket = getSocket();
        if (socket) {
          socket.emit("pet_equipping", { petImage });
        }

        // 3. 내 화면의 Phaser 플레이어 즉시 업데이트 (로컬용)
        if (typeof window !== "undefined") {
          // React -> Phaser 직접 통신 (커스텀 이벤트 사용)
          window.dispatchEvent(
            new CustomEvent("local_pet_update", { detail: { petImage } }),
          );
        }
      }
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
