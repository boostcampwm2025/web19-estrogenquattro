import { DayData } from "./useHeatmapData";
import { formatDate } from "../../lib/dateUtils";

interface HeatmapTooltipProps {
  day: DayData;
  position: { x: number; y: number };
}

export function HeatmapTooltip({ day, position }: HeatmapTooltipProps) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-none border-2 border-amber-700 bg-amber-900 px-3 py-2 text-sm text-amber-50 shadow-[2px_2px_0px_0px_#000]"
      style={{
        left: position.x + 10,
        top: position.y + 10,
      }}
    >
      <div>{formatDate(day.date)}</div>
      <div className="mt-1 text-amber-300">Point: {day.value}</div>
    </div>
  );
}
