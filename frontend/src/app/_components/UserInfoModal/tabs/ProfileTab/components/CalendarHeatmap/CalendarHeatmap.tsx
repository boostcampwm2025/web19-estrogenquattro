import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/_components/ui/button";
import { useHeatmapData, DayData, DailyTaskCount } from "./useHeatmapData";
import { getHeatmapColorClass } from "../../lib/heatmapColors";
import { isSameDay } from "../../lib/dateUtils";
import { HeatmapTooltip } from "./HeatmapTooltip";

interface CalendarHeatmapProps {
  dailyTaskCounts: DailyTaskCount[];
  onSelectDate: (date: Date) => void;
  selectedDate?: Date;
}

export function CalendarHeatmap({
  dailyTaskCounts,
  onSelectDate,
  selectedDate,
}: CalendarHeatmapProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { weeks } = useHeatmapData(dailyTaskCounts);

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

  const monthLabelsMap = new Map<number, string>();

  weeks.forEach((week, weekIndex) => {
    const sunday = week[0];
    if (sunday && sunday.value !== -1) {
      const date = sunday.date.getDate();
      // 일요일이 해당 월의 1-7일 사이에 있으면 월 레이블 표시
      if (date >= 1 && date <= 7) {
        const monthStr = sunday.date.toLocaleDateString("en-US", {
          month: "short",
        });
        monthLabelsMap.set(weekIndex, monthStr);
      }
    }
  });

  // 요일 레이블 (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
  // Mon, Wed, Fri만 표시
  const weekdayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="mb-6 rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => handleScroll("left")}
          className="h-7 w-7 shrink-0 rounded-none border-2 border-amber-800 bg-amber-700 text-amber-50 shadow-[2px_2px_0px_0px_#78350f] transition-all hover:bg-amber-800 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-1 gap-1 overflow-hidden">
          {/* 요일 레이블 */}
          <div className="flex shrink-0 flex-col pt-[21px]">
            {weekdayLabels.map((label, index) => (
              <div
                key={index}
                className={`flex h-3 items-center text-xs leading-3 font-bold text-amber-800 ${index < 6 ? "mb-0.75" : ""}`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 월 레이블 + 히트맵 */}
          <div
            ref={containerRef}
            className="scrollbar-hide flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="min-w-max">
              {/* 월 레이블 */}
              <div className="mb-1 flex h-3">
                {weeks.map((_, weekIndex) => (
                  <div
                    key={`month-${weekIndex}`}
                    className="w-4 text-xs font-bold whitespace-nowrap text-amber-800"
                  >
                    {monthLabelsMap.get(weekIndex) || ""}
                  </div>
                ))}
              </div>

              {/* 히트맵 */}
              <div className="inline-flex gap-1 px-1 pb-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-0.75">
                    {week.map((day, dayIndex) => (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={`h-3 w-3 rounded-sm transition-colors ${getHeatmapColorClass(day.value)} ${
                          day.value === -1
                            ? "cursor-default"
                            : isSameDay(day.date, selectedDate)
                              ? "ring-2 ring-amber-900"
                              : "cursor-pointer ring-1 ring-amber-300 hover:ring-2 hover:ring-amber-800"
                        }`}
                        onClick={() =>
                          day.value !== -1 && onSelectDate(day.date)
                        }
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
