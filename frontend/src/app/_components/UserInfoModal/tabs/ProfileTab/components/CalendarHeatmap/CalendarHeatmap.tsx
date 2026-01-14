import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Task } from "@/app/_components/TasksMenu/types";
import { Button } from "@/_components/ui/button";
import { useHeatmapData, DayData } from "./useHeatmapData";
import { getHeatmapColorClass } from "../../lib/heatmapColors";
import { isSameDay } from "../../lib/dateUtils";
import { HeatmapTooltip } from "./HeatmapTooltip";

interface CalendarHeatmapProps {
  tasks: Task[];
  onSelectDate: (date: Date) => void;
  selectedDate?: Date;
}

export function CalendarHeatmap({
  tasks,
  onSelectDate,
  selectedDate,
}: CalendarHeatmapProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { weeks } = useHeatmapData(tasks);

  const handleScroll = (direction: "left" | "right") => {
    const container = containerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newPosition =
      direction === "left"
        ? Math.max(0, scrollPosition - scrollAmount)
        : Math.min(
            container.scrollWidth - container.clientWidth,
            scrollPosition + scrollAmount,
          );

    setScrollPosition(newPosition);
    container.scrollTo({ left: newPosition, behavior: "smooth" });
  };

  const handleMouseMove = (e: React.MouseEvent, day: DayData) => {
    if (day.value === -1) return;
    setHoveredDay(day);
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollTo({ left: maxScroll, behavior: "auto" });
    setScrollPosition(maxScroll);
  }, []);

  return (
    <div className="mb-6 rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => handleScroll("left")}
          className="h-7 w-7 shrink-0 rounded-none border-2 border-amber-800 bg-amber-700 text-amber-50 shadow-[2px_2px_0px_0px_#78350f] transition-all hover:bg-amber-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={containerRef}
            className="scrollbar-hide overflow-x-auto"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div
              className="inline-flex gap-1"
              style={{ minWidth: "max-content" }}
            >
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day, dayIndex) => (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`h-3 w-3 rounded-none border transition-all ${getHeatmapColorClass(day.value)} ${
                        day.value === -1
                          ? "cursor-default border-transparent"
                          : isSameDay(day.date, selectedDate)
                            ? "scale-110 border-2 border-amber-900"
                            : "cursor-pointer border border-amber-300 hover:scale-110 hover:border-amber-800"
                      }`}
                      onClick={() => day.value !== -1 && onSelectDate(day.date)}
                      onMouseEnter={(e) => handleMouseMove(e, day)}
                      onMouseMove={(e) => handleMouseMove(e, day)}
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button
          onClick={() => handleScroll("right")}
          className="h-7 w-7 shrink-0 rounded-none border-2 border-amber-800 bg-amber-700 text-amber-50 shadow-[2px_2px_0px_0px_#78350f] transition-all hover:bg-amber-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {hoveredDay && hoveredDay.value !== -1 && (
        <HeatmapTooltip day={hoveredDay} position={mousePosition} />
      )}
    </div>
  );
}
