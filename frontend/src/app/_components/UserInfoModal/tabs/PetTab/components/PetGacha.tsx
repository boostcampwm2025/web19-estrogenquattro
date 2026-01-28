import { useState } from "react";
import Image from "next/image";
import { Pet, UserPet } from "@/lib/api/pet";

const PIXEL_BORDER = "border-4 border-amber-900";
const PIXEL_BTN =
  "bg-amber-600 px-4 py-2 hover:bg-amber-500 text-white border-b-4 border-r-4 border-amber-800 active:border-b-0 active:border-r-0 active:translate-y-1 active:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed";

interface PetGachaProps {
  onPetCollected: (petId: number) => void;
  onGacha: () => Promise<{ pet: UserPet["pet"]; isDuplicate: boolean }>;
  onGachaRefund?: () => Promise<{ refundAmount: number; totalPoint: number }>;
  points: number;
}

export default function PetGacha({
  onPetCollected,
  onGacha,
  onGachaRefund,
  points,
}: PetGachaProps) {
  const [status, setStatus] = useState<"idle" | "animating" | "result">("idle");
  const [resultPet, setResultPet] = useState<Pet | null>(null);

  const handleSummon = async () => {
    if (points < 100) {
      alert("포인트가 부족합니다!");
      return;
    }

    setStatus("animating");

    try {
      const { pet, isDuplicate } = await onGacha();

      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (isDuplicate && onGachaRefund) {
        await onGachaRefund();
      }

      if (pet) {
        setResultPet(pet);
        setStatus("result");
        if (!isDuplicate) {
          onPetCollected(pet.id);
        }
      } else {
        throw new Error("Unknown pet received");
      }
    } catch (e) {
      alert("뽑기 실패: " + e);
      setStatus("idle");
    }
  };

  const resetGacha = () => {
    setStatus("idle");
    setResultPet(null);
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

        {status === "result" && resultPet && (
          <div className="animate-pop flex flex-col items-center gap-4">
            <div className="relative h-24 w-24">
              <Image
                src={resultPet.actualImgUrl}
                alt={resultPet.name}
                fill
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-900">축하합니다!</p>
              <p className="text-sm text-amber-700">
                <span className="font-bold text-amber-900">
                  {resultPet.name}
                </span>
                을(를) 만났습니다!
              </p>
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
