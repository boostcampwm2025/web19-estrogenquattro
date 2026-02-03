import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { petApi } from "@/lib/api/pet";
import { getSocket } from "@/lib/socket";
import { queryKeys } from "@/lib/api/hooks/queryKeys";

export const usePetSystem = (playerId: number) => {
  const queryClient = useQueryClient();

  // 인벤토리 조회 (해당 유저의 펫 목록)
  const { data: inventory = [], isLoading: isInventoryLoading } = useQuery({
    queryKey: queryKeys.pets.inventory(playerId),
    queryFn: () => petApi.getInventory(playerId),
    enabled: !!playerId,
    staleTime: 0,
  });

  // 도감(Codex) 조회
  const { data: codex = [], isLoading: isCodexLoading } = useQuery({
    queryKey: queryKeys.pets.codex(playerId),
    queryFn: () => petApi.getCodex(playerId),
    enabled: !!playerId,
    staleTime: 0,
  });

  // 플레이어 정보 (장착 펫 확인용)
  const { data: player, isLoading: isPlayerLoading } = useQuery({
    queryKey: queryKeys.player.info(playerId),
    queryFn: () => petApi.getPlayer(playerId),
    enabled: !!playerId,
    staleTime: 0,
  });

  // 전체 펫 목록 (도감용)
  const { data: allPets = [], isLoading: isAllPetsLoading } = useQuery({
    queryKey: queryKeys.pets.allPets(),
    queryFn: petApi.getAllPets,
    staleTime: 1000 * 60 * 60, // 1 hour (데이터가 잘 안 바뀌므로)
  });

  const isLoading =
    isInventoryLoading || isCodexLoading || isPlayerLoading || isAllPetsLoading;

  const gachaMutation = useMutation({
    mutationFn: petApi.gacha,
    onSuccess: () => {
      // 포인트 즉시 차감 동기화를 위해 플레이어 정보는 즉시 갱신
      queryClient.invalidateQueries({
        queryKey: queryKeys.player.info(playerId),
      });
    },
  });

  const refreshPets = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.pets.inventory(playerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.pets.codex(playerId),
    });
  }, [queryClient, playerId]);

  // 가챠 환급 (중복 펫 시)
  const gachaRefundMutation = useMutation({
    mutationFn: petApi.gachaRefund,
    onSuccess: () => {
      // 환급 후 포인트 갱신
      queryClient.invalidateQueries({
        queryKey: queryKeys.player.info(playerId),
      });
    },
  });

  // 먹이주기
  const feedMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.feed(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pets.inventory(playerId),
      });
      // 포인트 차감 동기화를 위해 플레이어 정보 갱신
      queryClient.invalidateQueries({
        queryKey: queryKeys.player.info(playerId),
      });
    },
  });

  // 진화
  const evolveMutation = useMutation({
    mutationFn: (userPetId: number) => petApi.evolve(userPetId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pets.inventory(playerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.pets.codex(playerId),
      });
    },
  });

  // 대표 펫 장착
  const equipMutation = useMutation({
    mutationFn: (petId: number) => petApi.equipPet(petId),
    onSuccess: (_, petId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.player.info(playerId),
      });

      // 1. 소켓으로 petId 전송 (서버가 DB 검증 후 petImage 브로드캐스트)
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit("pet_equipping", { petId });
      }

      // 2. 내 화면의 Phaser 플레이어 즉시 업데이트 (로컬용)
      // allPets에서 petImage를 찾아서 로컬 게임에 반영
      if (!allPets || allPets.length === 0) {
        console.warn("allPets not loaded yet for local update");
        return;
      }

      const targetPet = allPets.find((p) => p.id === petId);
      if (targetPet && typeof window !== "undefined") {
        const petImage = targetPet.actualImgUrl;
        // React -> Phaser 직접 통신 (커스텀 이벤트 사용)
        window.dispatchEvent(
          new CustomEvent("local_pet_update", { detail: { petImage } }),
        );
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
    gachaRefund: gachaRefundMutation.mutateAsync,
    refreshPets,
    feed: feedMutation.mutateAsync,
    evolve: evolveMutation.mutateAsync,
    equip: equipMutation.mutateAsync,
  };
};
