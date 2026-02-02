import { useState, useEffect, useMemo } from "react";
import { usePetSystem } from "./hooks/usePetSystem";
import PetGacha from "./components/PetGacha";
import PetCard from "./components/PetCard";
import PetCodex from "./components/PetCodex";
import { LicenseInfo } from "./components/LicenseInfo";
import { useModalStore } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";
import { UserPet } from "@/lib/api/pet";

export default function PetTab() {
  const targetPlayerId = useModalStore(
    (state) => state.userInfoPayload?.playerId,
  );
  const { user } = useAuthStore();

  const playerId = targetPlayerId ?? 0;
  const isOwner = user?.playerId === playerId;

  const {
    inventory,
    codex,
    player,
    feed,
    evolve,
    equip,
    gacha,
    gachaRefund,
    refreshPets,
    allPets,
    isLoading,
  } = usePetSystem(playerId);

  // 현재 선택된 펫 ID (초기값 null -> 로딩 전에는 렌더링 방지)
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedPetId(null);
  }, [playerId]);

  // isLoading이 완전히 끝난 후(player 정보도 로드된 후)에만 초기값을 설정하도록 변경.
  useEffect(() => {
    if (selectedPetId !== null || isLoading) return;

    // 로딩이 끝났는데 player 정보가 있다면 장착 펫 우선
    if (player?.equippedPetId) {
      setSelectedPetId(player.equippedPetId);
    } else if (inventory.length > 0) {
      // 장착된 펫이 없으면 인벤토리 첫번째(서비스 처음 사용후 펫 뽑기완료시)
      setSelectedPetId(inventory[0].pet.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, inventory, isLoading]);

  const collectedPetIds = codex;

  // 선택된 펫의 UI 표시 정보 계산
  const selectedPetDef = allPets.find((p) => p.id === selectedPetId);
  const currentUserPet = inventory.find((p) => p.pet.id === selectedPetId);

  //도감에는 있지만 내 인벤토리에 실존하지 않는 경우 -> 성장을 끝낸 이전 펫(스킨개념)
  const isPastSkin = !currentUserPet;

  // 경험치 및 성장 가능 여부 계산
  const currentExp = currentUserPet?.exp || 0;
  const requiredExp = selectedPetDef?.evolutionRequiredExp || 0;

  // Past Skin이거나 데이터가 없으면 Max Exp(0) 처리하여 성장 불가로 만듦
  const maxExp = isPastSkin || !selectedPetDef ? 0 : requiredExp;

  // UI용 데이터 어댑터
  const petCardData = selectedPetDef
    ? {
        stage: selectedPetDef.evolutionStage,
        name: selectedPetDef.name,
        description: selectedPetDef.description,
        image: selectedPetDef.actualImgUrl,
        maxExp: requiredExp,
      }
    : null;

  const isMaxStage = maxExp === 0;
  const isReadyToEvolve = !isMaxStage && currentExp >= maxExp;

  const handleAction = async () => {
    if (!currentUserPet) {
      alert("보유하지 않은 펫입니다!");
      return;
    }

    try {
      if (isReadyToEvolve) {
        // 진화 요청
        const newPet = await evolve(currentUserPet.id);
        // 진화 성공 시 UI 자동 업데이트
        setSelectedPetId(newPet.pet.id);

        // 진화된 펫을 자동으로 대표 펫으로 설정
        try {
          await equip(newPet.pet.id);
        } catch (err) {
          console.error("Auto-equip failed after evolution:", err);
        }
      } else {
        // 밥주기 요청
        await feed(currentUserPet.id);
      }
    } catch (e) {
      alert("작업 실패: " + e);
    }
  };

  const handlePetCollected = async (petId: number) => {
    // 가챠 성공 콜백 (애니메이션 종료 후)
    // 인벤토리 및 도감 갱신 (스포일러 방지 해제)
    refreshPets();

    // 인벤토리가 비어있었다면(첫 펫 획득), 자동으로 선택 및 장착
    if (inventory.length === 0) {
      setSelectedPetId(petId);
      try {
        await equip(petId);
      } catch (e) {
        console.error("Auto-equip first pet failed:", e);
      }
    }
  };

  const handleGachaExecution = async (): Promise<{
    pet: UserPet["pet"];
    isDuplicate: boolean;
  }> => {
    const response = await gacha();
    return { pet: response.userPet.pet, isDuplicate: response.isDuplicate };
  };

  const handlePetSelect = async (petId: number) => {
    setSelectedPetId(petId);

    if (!isOwner) return;

    try {
      await equip(petId);
    } catch (e) {
      console.error("Failed to equip pet:", e);
    }
  };

  // playerId가 유효하지 않거나 필수 데이터(allPets)가 없으면 로딩
  if (!playerId || (allPets.length === 0 && isLoading))
    return <div>Loading...</div>;

  const points = player?.totalPoint ?? 0;

  // Check if user has collected all stage1 pets
  const hasCollectedAllStage1 = useMemo(() => {
    const stage1PetIds = allPets
      .filter((p) => p.evolutionStage === 1)
      .map((p) => p.id);

    if (stage1PetIds.length === 0) return false;

    return stage1PetIds.every((id) => collectedPetIds.includes(id));
  }, [allPets, collectedPetIds]);

  return (
    <div className="flex h-auto flex-col gap-4 text-amber-900">
      {/* 라이선스 정보 링크 */}
      <div className="flex justify-end">
        <LicenseInfo />
      </div>

      {/* 펫이 선택되었을 때만 카드 표시 (신규 유저는 안 보임 -> 자연스럽게 가챠 유도) */}
      {petCardData ? (
        <PetCard
          exp={currentExp}
          maxExp={maxExp}
          currentStageData={petCardData}
          onAction={handleAction}
          isOwner={isOwner}
          points={points}
        />
      ) : (
        <div className="border-4 border-amber-900/20 bg-amber-50 p-8 text-center text-amber-700">
          <p className="text-lg font-bold">보유한 펫이 없습니다</p>
          {isOwner && (
            <p className="text-sm">아래에서 새로운 펫을 받아보세요!</p>
          )}
        </div>
      )}

      {isOwner && (
        <PetGacha
          onGacha={handleGachaExecution}
          onGachaRefund={gachaRefund}
          onPetCollected={handlePetCollected}
          points={points}
          hasCollectedAllStage1={hasCollectedAllStage1}
        />
      )}
      <PetCodex
        allPets={allPets}
        collectedPetIds={collectedPetIds}
        equippedPetId={selectedPetId || -1}
        onPetSelect={handlePetSelect}
        isOwner={isOwner}
      />
    </div>
  );
}
