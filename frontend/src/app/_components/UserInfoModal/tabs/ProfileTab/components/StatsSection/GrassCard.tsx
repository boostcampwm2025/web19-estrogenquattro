import Image from "next/image";
import Mascot from "./Mascot";
import { getGrassImageFromData } from "../../lib/grassLevel";
import { toDateString } from "@/utils/timeFormat";
import { DailyPoints } from "../CalendarHeatmap/useHeatmapData";

interface GrassCardProps {
  dailyPoints: DailyPoints;
  selectedDate: Date;
}

export default function GrassCard({ dailyPoints, selectedDate }: GrassCardProps) {
  const dateStr = toDateString(selectedDate);
  const grassImagePath = getGrassImageFromData(dailyPoints, dateStr);

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
            {index === 0 && (
              <Mascot src="/assets/mascot/gopher_stage1.svg" alt="Gopher" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
