import Image from "next/image";
import { useState } from "react";

const PIXEL_BORDER = "border-4 border-amber-900";
const PIXEL_BTN =
  "bg-green-600 px-2 hover:bg-green-500 text-white border-b-4 border-r-4 border-green-800 active:border-b-0 active:border-r-0 active:translate-y-1 active:translate-x-1";

interface PetCardProps {
  stage: number;
  exp: number;
  maxExp: number;
  currentStageData: {
    stage: number;
    name: string;
    description: string;
    image: string;
    maxExp: number;
  };
  onAction: () => void;
}

export default function PetCard({
  stage,
  exp,
  maxExp,
  currentStageData,
  onAction,
}: PetCardProps) {
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);

  const isMaxStage = maxExp === 0;
  const isReadyToEvolve = !isMaxStage && exp >= maxExp;

  const handleFeedClick = () => {
    onAction();

    // 진화/만렙이 아닐 때(밥주기 일 때)만 하트 효과 생성
    if (!isReadyToEvolve && !isMaxStage) {
      const id = Date.now();
      const x = Math.random() * 40 - 20; // -20px ~ +20px
      setHearts((prev) => [...prev, { id, x }]);

      setTimeout(() => {
        setHearts((prev) => prev.filter((heart) => heart.id !== id));
      }, 800);
    }
  };

  return (
    <div className={`flex gap-6 bg-amber-50 p-4 ${PIXEL_BORDER}`}>
      <div className="flex flex-col items-center justify-center">
        <div className="relative h-32 w-32 drop-shadow-xl">
          {hearts.map((heart) => (
            <span
              key={heart.id}
              className="flying-heart"
              style={
                {
                  "--random-x": `${heart.x}px`,
                  left: "50%", // Center origin horizontally
                  top: "0", // Start from top of container (close to pet head)
                } as React.CSSProperties
              }
            >
              ❤️
            </span>
          ))}
          <Image
            src={currentStageData.image}
            alt={currentStageData.name}
            fill
            className="object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between text-sm font-bold">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-widest">
            {currentStageData.name}
          </h2>
        </div>

        <p className="text-sm text-amber-700">
          {isReadyToEvolve
            ? "✨ 진화가 가능합니다!"
            : currentStageData.description}
        </p>

        {/* 경험치 및 밥주기 섹션 */}
        <div className="flex w-full items-end gap-3">
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-lg">
              <span>EXP</span>
              <span>{isMaxStage ? "MAX" : `${exp} / ${maxExp}`}</span>
            </div>
            <div className="relative h-6 w-full border-2 border-amber-900 bg-amber-900/10">
              <div
                className={`h-full transition-all duration-300 ease-out ${isReadyToEvolve ? "animate-pulse bg-amber-500" : "bg-green-500"}`}
                style={{
                  width: isMaxStage ? "100%" : `${(exp / maxExp) * 100}%`,
                }}
              />
              {/* 눈금 효과 */}
              <div className="absolute inset-0 flex">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 border-r border-amber-900/20"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="relative flex w-1/5 justify-center">
            <button
              onClick={handleFeedClick}
              disabled={isMaxStage}
              className={`flex h-12 w-full flex-col items-center justify-center rounded text-lg leading-tight font-bold transition-all ${
                isMaxStage
                  ? "cursor-not-allowed border-r-4 border-b-4 border-gray-600 bg-gray-400 text-white opacity-70"
                  : isReadyToEvolve
                    ? "border-r-4 border-b-4 border-amber-800 bg-amber-600 text-white hover:bg-amber-500 active:translate-x-1 active:translate-y-1 active:border-r-0 active:border-b-0"
                    : PIXEL_BTN
              }`}
            >
              <span>{isReadyToEvolve ? "✨ 진화" : "🍖 밥주기"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
