import { useState } from "react";
import PetCard from "./components/petCard";

const PET_EVOLUTION_DATA = [
  {
    stage: 1,
    name: "취준GO",
    description: "아직은 작고 귀여운 펫입니다. 밥을 주어 성장시켜보세요!",
    image: "/assets/pets/pet1.png",
    maxExp: 30,
  },
  {
    stage: 2,
    name: "신입GO",
    description: "무럭무럭 자라난 펫입니다. 더 높은 곳을 향해!",
    image: "/assets/pets/pet2.png",
    maxExp: 100,
  },
  {
    stage: 3,
    name: "시니어GO",
    description: "모든 성장을 마친 전설적인 펫입니다. 위엄이 느껴집니다.",
    image: "/assets/pets/pet3.png",
    maxExp: 0, // 0을 MAX level로 판단
  },
];

export default function PetTab() {
  const [stage, setStage] = useState(1);
  const [exp, setExp] = useState(0);

  // 현재 단계 데이터 가져오기
  const currentStageData =
    PET_EVOLUTION_DATA.find((data) => data.stage === stage) ||
    PET_EVOLUTION_DATA[0];
  const maxExp = currentStageData.maxExp;
  const isMaxStage = maxExp === 0;
  const isReadyToEvolve = !isMaxStage && exp >= maxExp;

  const handleAction = () => {
    if (isReadyToEvolve) {
      // 진화 로직
      setStage((prev) => Math.min(prev + 1, PET_EVOLUTION_DATA.length));
      setExp(0);
    } else {
      // 밥주기 로직 (만렙이면 경험치 안 오름)
      if (isMaxStage) return;
      setExp((prev) => Math.min(prev + 10, maxExp));
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 text-amber-900">
      <PetCard
        stage={stage}
        exp={exp}
        maxExp={maxExp}
        currentStageData={currentStageData}
        onAction={handleAction}
      />
    </div>
  );
}
