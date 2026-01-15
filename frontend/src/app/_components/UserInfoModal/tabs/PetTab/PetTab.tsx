import { useState } from "react";
import { usePointStore } from "@/stores/pointStore";
import PetGacha from "./components/PetGacha";
import PetCard from "./components/PetCard";
import PetCodex from "./components/PetCodex";
import { PETS_DATA } from "./data/pets";
import { getEvolutionLine } from "./lib/petUtils";

export default function PetTab() {
  const [activePetId, setActivePetId] = useState("pet-basic-1");
  const [stage, setStage] = useState(1);
  const [exp, setExp] = useState(0);
  const [collectedPetIds, setCollectedPetIds] = useState<string[]>([
    "pet-basic-1",
  ]);
  const subtractPoints = usePointStore((state) => state.subtractPoints);

  const currentEvolutionLine = getEvolutionLine(activePetId);

  // 현재 단계 데이터 가져오기
  const currentStageData =
    currentEvolutionLine.find((data) => data.stage === stage) ||
    currentEvolutionLine[0];

  const maxExp = currentStageData.maxExp;
  const isMaxStage = maxExp === 0;
  const isReadyToEvolve = !isMaxStage && exp >= maxExp;

  const handleAction = () => {
    if (isReadyToEvolve) {
      const nextStage = stage + 1;
      // 진화 로직 (포인트 소모 없음)
      setStage((prev) => Math.min(prev + 1, currentEvolutionLine.length));
      setExp(0);

      // 진화 시 다음 단계 펫도 수집된 것으로 처리
      const nextPet = currentEvolutionLine.find((p) => p.stage === nextStage);
      if (nextPet) {
        handlePetCollected(nextPet.id);
      }
    } else {
      // 밥주기 로직 (10 포인트 소모)
      if (isMaxStage) return;

      if (!subtractPoints(10)) {
        alert("포인트가 부족합니다! (필요: 10 P)");
        return;
      }

      setExp((prev) => Math.min(prev + 10, maxExp));
    }
  };

  const handlePetCollected = (petId: string) => {
    if (!collectedPetIds.includes(petId)) {
      setCollectedPetIds((prev) => [...prev, petId]);
    }
  };

  const handlePetSelect = (petId: string) => {
    const selectedPet = PETS_DATA.find((p) => p.id === petId);
    if (selectedPet) {
      setActivePetId(petId);
      setStage(selectedPet.stage);
      setExp(0); // 펫 변경 시 경험치 리셋
    }
  };

  return (
    <div className="flex h-auto flex-col gap-4 text-amber-900">
      <PetCard
        stage={stage}
        exp={exp}
        maxExp={maxExp}
        currentStageData={currentStageData}
        onAction={handleAction}
      />
      <PetGacha onPetCollected={handlePetCollected} />
      <PetCodex
        collectedPetIds={collectedPetIds}
        activePetId={activePetId}
        onPetSelect={handlePetSelect}
      />
    </div>
  );
}
