import { useState } from "react";
import Image from "next/image";
import { usePointStore } from "@/stores/pointStore";

const PIXEL_BORDER = "border-4 border-amber-900";
const PIXEL_BTN =
  "bg-amber-600 px-4 py-2 hover:bg-amber-500 text-white border-b-4 border-r-4 border-amber-800 active:border-b-0 active:border-r-0 active:translate-y-1 active:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed";

export default function PetGacha() {
  const [status, setStatus] = useState<"idle" | "animating" | "result">("idle");
  const [resultImage, setResultImage] = useState<string | null>(null);

  const points = usePointStore((state) => state.points);
  const subtractPoints = usePointStore((state) => state.subtractPoints);

  const handleSummon = () => {
    if (!subtractPoints(100)) return;

    setStatus("animating");

    // 5초 후 결과 표시 (애니메이션 시간과 동기화)
    setTimeout(() => {
      // 랜덤 펫 이미지 (1~3 중 랜덤)
      const randomStage = Math.floor(Math.random() * 3) + 1;
      setResultImage(`/assets/pets/pet${randomStage}.png`);
      setStatus("result");
    }, 5000);
  };

  const resetGacha = () => {
    setStatus("idle");
    setResultImage(null);
  };

  return (
    <div className={`flex flex-col gap-4 bg-amber-50 p-6 ${PIXEL_BORDER}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-amber-900/20 pb-2">
        <h3 className="text-xl font-bold text-amber-900">펫 뽑기</h3>
      </div>

      {/* Main Content */}
      <div className="flex h-60 flex-col items-center justify-center gap-4">
        {status === "idle" && (
          <>
            <div className="gacha-egg" />
            <p className="text-center text-sm text-amber-700">
              어떤 펫이 나올까요?
              <br />
              (1회: 100 P)
            </p>
            <button
              onClick={handleSummon}
              disabled={points < 100}
              className={PIXEL_BTN}
            >
              펫 뽑기
            </button>
          </>
        )}

        {status === "animating" && (
          <div className="flex flex-col items-center gap-4">
            <div className="gacha-egg animating" />
            <p className="animate-pulse text-lg font-bold text-amber-800">
              알이 깨지고 있어요!
            </p>
          </div>
        )}

        {status === "result" && resultImage && (
          <div className="animate-pop flex flex-col items-center gap-4">
            <div className="relative h-24 w-24">
              <Image
                src={resultImage}
                alt="Summoned Pet"
                fill
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-900">축하합니다!</p>
              <p className="text-sm text-amber-700">새로운 펫을 만났습니다!</p>
            </div>
            <button onClick={resetGacha} className={PIXEL_BTN}>
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
