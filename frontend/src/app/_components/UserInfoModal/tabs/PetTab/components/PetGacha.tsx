import { useState, memo } from "react";
import Image from "next/image";
import { Pet, UserPet } from "@/lib/api/pet";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

const PIXEL_BORDER = "border-4 border-amber-900";
const PIXEL_BTN =
  "cursor-pointer bg-amber-600 px-4 py-2 hover:bg-amber-500 text-white border-b-4 border-r-4 border-amber-800 active:border-b-0 active:border-r-0 active:translate-y-1 active:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed";

interface PetGachaProps {
  onPetCollected: (petId: number) => void;
  onGacha: () => Promise<{ pet: UserPet["pet"]; isDuplicate: boolean }>;
  onGachaRefund?: () => Promise<{ refundAmount: number; totalPoint: number }>;
  points: number;
  hasCollectedAllStage1?: boolean;
}

const PetGacha = memo(function PetGacha({
  onPetCollected,
  onGacha,
  onGachaRefund,
  points,
  hasCollectedAllStage1 = false,
}: PetGachaProps) {
  const { t } = useTranslation("ui");
  const [status, setStatus] = useState<"idle" | "animating" | "result">("idle");
  const [resultPet, setResultPet] = useState<Pet | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [showRefundAnim, setShowRefundAnim] = useState(false);
  const resultPetId = resultPet
    ? (String(
        resultPet.id,
      ) as keyof (typeof import("@/locales/ko/ui.json"))["userInfoModal"]["pet"]["pets"])
    : null;

  const handleSummon = async () => {
    if (points < 100) {
      alert(t(($) => $.userInfoModal.pet.gacha.notEnoughPoints));
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
        setIsDuplicate(isDuplicate);
        setStatus("result");
        if (!isDuplicate) {
          onPetCollected(pet.id);
        } else {
          // 중복일 경우 0.5초 후 환급 애니메이션 시작
          setTimeout(() => setShowRefundAnim(true), 500);
        }
      } else {
        throw new Error("Unknown pet received");
      }
    } catch (e) {
      alert(
        t(($) => $.userInfoModal.pet.gacha.gachaFailed, { error: String(e) }),
      );
      setStatus("idle");
    }
  };

  const resetGacha = () => {
    setStatus("idle");
    setResultPet(null);
    setIsDuplicate(false);
    setShowRefundAnim(false);
  };

  return (
    <div className={`flex flex-col gap-4 bg-amber-50 p-6 ${PIXEL_BORDER}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-amber-900/20 pb-2">
        <h3 className="text-xl font-bold text-amber-900">
          {t(($) => $.userInfoModal.pet.gacha.title)}
        </h3>
      </div>

      {/* Main Content */}
      <div className="flex h-60 flex-col items-center justify-center gap-4">
        {status === "idle" && (
          <>
            <div
              className={`gacha-egg ${hasCollectedAllStage1 ? "opacity-50 grayscale" : ""}`}
            />
            {hasCollectedAllStage1 ? (
              <>
                <p className="text-center text-xs text-amber-600">
                  {t(($) => $.userInfoModal.pet.gacha.noMorePets)}
                  <br />
                  {t(($) => $.userInfoModal.pet.gacha.noMorePetsHint)}
                </p>
                <button id="pet-gacha-button" disabled className={PIXEL_BTN}>
                  {t(($) => $.userInfoModal.pet.gacha.button)}
                </button>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-amber-700">
                  {t(($) => $.userInfoModal.pet.gacha.prompt)}
                  <br />
                  {t(($) => $.userInfoModal.pet.gacha.cost)}
                </p>
                <button
                  id="pet-gacha-button"
                  onClick={handleSummon}
                  disabled={points < 100}
                  className={PIXEL_BTN}
                >
                  {t(($) => $.userInfoModal.pet.gacha.button)}
                </button>
              </>
            )}
          </>
        )}

        {status === "animating" && (
          <div className="flex flex-col items-center gap-4">
            <div className="gacha-egg animating" />
            <p className="animate-pulse text-lg font-bold text-amber-800">
              {t(($) => $.userInfoModal.pet.gacha.hatching)}
            </p>
          </div>
        )}

        {status === "result" && resultPet && resultPetId && (
          <div className="animate-pop flex flex-col items-center gap-4">
            <div className="relative h-24 w-24">
              <Image
                src={resultPet.actualImgUrl}
                alt={t(($) => $.userInfoModal.pet.pets[resultPetId].name)}
                fill
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <div className="flex flex-col items-center text-center">
              {isDuplicate ? (
                <>
                  <p className="font-bold text-amber-700">
                    {t(($) => $.userInfoModal.pet.gacha.duplicate)}
                  </p>
                  <span className="font mt-1 font-bold text-amber-800">
                    {t(($) => $.userInfoModal.pet.gacha.refund)}
                    <span className="font mt-1 rounded bg-amber-200 px-2 py-0.5 text-amber-800">
                      {t(($) => $.userInfoModal.pet.gacha.refundAmount)}
                    </span>
                    {t(($) => $.userInfoModal.pet.gacha.refundSuffix)}
                  </span>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-amber-900">
                    {t(($) => $.userInfoModal.pet.gacha.congrats)}
                  </p>
                  <p className="text-sm text-amber-700">
                    {t(($) => $.userInfoModal.pet.gacha.gotPet, {
                      name: t(
                        ($) => $.userInfoModal.pet.pets[resultPetId].name,
                      ),
                    })}
                  </p>
                </>
              )}
            </div>

            {/* 환급 애니메이션 */}
            <AnimatePresence>
              {showRefundAnim && (
                <motion.div
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: 1, y: -200, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="absolute z-50 flex items-center gap-1 font-bold text-yellow-500 drop-shadow-md"
                  style={{ top: "40%" }}
                  onAnimationComplete={() => setShowRefundAnim(false)}
                >
                  <span className="text-2xl">💰</span>
                  <span className="text-xl">+50P</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={resetGacha} className={PIXEL_BTN}>
              {t(($) => $.userInfoModal.pet.gacha.confirm)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default PetGacha;
