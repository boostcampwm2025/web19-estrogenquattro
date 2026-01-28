"use client";

import Image from "next/image";
import Mascot from "./Mascot";
import { getGrassImageFromData } from "../../lib/grassLevel";
import { toDateString } from "@/utils/timeFormat";
import { DailyPoints } from "../CalendarHeatmap/useHeatmapData";
import { useQuery } from "@tanstack/react-query";
import { petApi } from "@/lib/api/pet";

interface GrassCardProps {
  dailyPoints: DailyPoints;
  selectedDate: Date;
  playerId: number;
}

const MAX_DISPLAY_PETS = 9; // 3x3 그리드에 표시할 최대 펫 개수

export default function GrassCard({
  dailyPoints,
  selectedDate,
  playerId,
}: GrassCardProps) {
  const dateStr = toDateString(selectedDate);
  const grassImagePath = getGrassImageFromData(dailyPoints, dateStr);

  const { data: inventory = [] } = useQuery({
    queryKey: ["pets", "inventory", playerId],
    queryFn: () => petApi.getInventory(playerId),
    enabled: !!playerId,
    staleTime: 0,
  });
  const petsToDisplay = inventory.slice(0, MAX_DISPLAY_PETS);

  return (
    <div className="relative size-60 shrink-0 overflow-visible rounded-none">
      {/* 잔디 배경 이미지 */}
      <Image
        src={grassImagePath}
        alt="Garden"
        fill
        className="scale-115 object-fill"
        style={{ imageRendering: "pixelated" }}
        priority
      />

      {/* 3x3 그리드 (마스코트 배치용) */}
      <div className="relative grid h-full w-full grid-cols-3 grid-rows-3 p-2">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            className="relative flex items-center justify-center"
          >
            {petsToDisplay[index] && (
              <div className="size-14">
                <Mascot
                  src={petsToDisplay[index].pet.actualImgUrl}
                  alt={petsToDisplay[index].pet.name}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
