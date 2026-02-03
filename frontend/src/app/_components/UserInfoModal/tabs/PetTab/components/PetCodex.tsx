import { Pet } from "@/lib/api/pet";
import { memo, useMemo } from "react";

const PIXEL_BORDER = "border-4 border-amber-900";
const PIXEL_CARD =
  "relative flex flex-col items-center justify-center bg-amber-100 p-2 aspect-auto hover:bg-amber-200 transition-colors border-2 border-amber-900/50";

interface PetCodexProps {
  allPets: Pet[];
  collectedPetIds: number[];
  equippedPetId?: number;
  onPetSelect: (petId: number) => void;
  isOwner: boolean;
}

const PetCodex = memo(function PetCodex({
  allPets,
  collectedPetIds,
  equippedPetId,
  onPetSelect,
  isOwner,
}: PetCodexProps) {
  // 미리 펫들을 종류별로 그룹화 (Memoized)
  const groupedPets = useMemo(() => {
    return allPets.reduce<Record<string, Pet[]>>((acc, pet) => {
      if (!acc[pet.species]) {
        acc[pet.species] = [];
      }
      acc[pet.species].push(pet);
      return acc;
    }, {});
  }, [allPets]);

  return (
    <div className={`flex flex-col gap-4 bg-amber-50 p-6 ${PIXEL_BORDER}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-amber-900/20 pb-2">
        <h3 className="text-xl font-bold text-amber-900">펫 도감</h3>
        <span className="text-xs font-bold text-amber-700">
          {collectedPetIds.length} / {allPets.length} 수집
        </span>
      </div>

      {/* 진화라인 그룹 리스트 */}
      <div className="flex h-auto flex-col gap-3">
        {Object.entries(groupedPets).map(([species, pets]) => (
          <div
            key={species}
            className="flex flex-col gap-2 bg-amber-100/50 p-3 shadow-sm"
          >
            <div className="grid w-full grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
              {pets.map((pet, index) => {
                const isCollected = collectedPetIds.includes(pet.id);
                // 선택된 펫은 곧 장착된 펫이므로 강조 표시 및 뱃지 부착
                const isEquipped = pet.id === equippedPetId;
                const isLast = index === pets.length - 1;

                return (
                  <div key={pet.id} className="contents">
                    {/* 펫 카드 */}
                    <div
                      onClick={() =>
                        isCollected && isOwner && onPetSelect(pet.id)
                      }
                      className={`${PIXEL_CARD} w-full ${
                        isCollected && isOwner
                          ? "cursor-pointer"
                          : isCollected
                            ? "cursor-default"
                            : "bg-gray-200"
                      } ${isEquipped ? "border-amber-600 bg-amber-200" : ""}`}
                      title={isCollected ? pet.description : "???"}
                    >
                      {/* 장착 뱃지 (선택된 펫 = 장착된 펫) */}
                      {isEquipped && (
                        <div className="absolute -top-2 -right-2 z-10 rotate-12 rounded border border-red-800 bg-red-500 px-1.5 py-0.5 text-[12px] font-bold text-white shadow-sm">
                          대표펫
                        </div>
                      )}
                      <div className="relative mb-2 flex h-14 w-14 items-center justify-center">
                        <img
                          src={
                            isCollected
                              ? pet.actualImgUrl
                              : pet.silhouetteImgUrl
                          }
                          alt={isCollected ? pet.name : "???"}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <p
                        className={`w-full text-center text-xs font-bold ${
                          isCollected ? "text-amber-900" : "text-gray-500"
                        }`}
                      >
                        {isCollected ? pet.name : "???"}
                      </p>
                    </div>

                    {/* 진화 화살표 */}
                    {!isLast && (
                      <div className="flex justify-center text-amber-900/40">
                        ▶
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default PetCodex;
