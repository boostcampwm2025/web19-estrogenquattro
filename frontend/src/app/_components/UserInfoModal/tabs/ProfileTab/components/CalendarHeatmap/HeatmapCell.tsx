import { getHeatmapColorClass } from "../../lib/grassLevel";
import { isSameDay } from "../../lib/dateUtils";
import { DayData } from "./useHeatmapData";

interface HeatmapCellProps {
  day: DayData;
  selectedDate?: Date;
  onSelectDate: (date: Date) => void;
  onMouseEnter: (e: React.MouseEvent, day: DayData) => void;
  onMouseMove: (e: React.MouseEvent, day: DayData) => void;
  onMouseLeave: () => void;
}

export function HeatmapCell({
  day,
  selectedDate,
  onSelectDate,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: HeatmapCellProps) {
  return (
    <div
      className={`h-3 w-3 rounded-sm transition-colors ${getHeatmapColorClass(day.value)} ${
        day.value === -1
          ? "cursor-default"
          : isSameDay(day.date, selectedDate)
            ? "ring-2 ring-amber-900"
            : "cursor-pointer ring-1 ring-amber-300 hover:ring-2 hover:ring-amber-800"
      }`}
      onClick={() => day.value !== -1 && onSelectDate(day.date)}
      onMouseEnter={(e) => onMouseEnter(e, day)}
      onMouseMove={(e) => onMouseMove(e, day)}
      onMouseLeave={onMouseLeave}
    />
  );
}
