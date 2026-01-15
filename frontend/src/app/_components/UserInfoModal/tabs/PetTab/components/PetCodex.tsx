import Image from "next/image";
import { PETS_DATA } from "../data/pets";

const PIXEL_BORDER = "border-4 border-amber-900";
const PIXEL_CARD =
  "relative flex flex-col items-center justify-center bg-amber-100 p-2 aspect-auto hover:bg-amber-200 transition-colors border-2 border-amber-900/50";

interface PetCodexProps {
  collectedPetIds: string[];
  onPetSelect: (petId: string) => void;
}

export default function PetCodex({
  collectedPetIds,
  onPetSelect,
}: PetCodexProps) {
  return (
    <div className={`flex flex-col gap-4 bg-amber-50 p-6 ${PIXEL_BORDER}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-amber-900/20 pb-2">
        <h3 className="text-xl font-bold text-amber-900">펫 도감</h3>
        <span className="text-xs font-bold text-amber-700">
          {collectedPetIds.length} / {PETS_DATA.length} 수집
        </span>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-3 p-1">
        {PETS_DATA.map((pet) => {
          const isCollected = collectedPetIds.includes(pet.id);

          return (
            <div
              key={pet.id}
              onClick={() => isCollected && onPetSelect(pet.id)}
              className={`${PIXEL_CARD} ${
                isCollected ? "cursor-pointer" : "bg-gray-200"
              }`}
              title={isCollected ? pet.description : "???"}
            >
              <div className="relative mb-2 h-16 w-16">
                <Image
                  src={pet.image}
                  alt={pet.name}
                  fill
                  className={`object-contain ${
                    isCollected
                      ? ""
                      : "pointer-events-none opacity-40 brightness-0 grayscale"
                  }`}
                />
              </div>
              <p
                className={`text-center text-xs font-bold ${
                  isCollected ? "text-amber-900" : "text-gray-500"
                }`}
              >
                {isCollected ? pet.name : "???"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
