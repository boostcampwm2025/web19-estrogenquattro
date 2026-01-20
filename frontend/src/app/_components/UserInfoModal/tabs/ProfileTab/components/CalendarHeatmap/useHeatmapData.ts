import { useMemo } from "react";
import { toDateString } from "@/utils/timeFormat";

export interface DayData {
  date: Date;
  value: number;
}

// DB에서 받아올 날짜별 데이터 타입
export interface DailyTaskCount {
  date: string; // "YYYY-MM-DD" 형식
  taskCount: number;
}

interface UseHeatmapDataResult {
  yearData: DayData[];
  weeks: DayData[][];
}

export function useHeatmapData(
  dailyTaskCounts: DailyTaskCount[],
): UseHeatmapDataResult {
  const yearData = useMemo(() => {
    // DB에서 받은 데이터를 Map으로 변환 (빠른 조회용)
    const taskCountByDate = new Map<string, number>();
    dailyTaskCounts.forEach((item) => {
      taskCountByDate.set(item.date, item.taskCount);
    });

    const days: DayData[] = [];
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateKey = toDateString(d); // "YYYY-MM-DD" 형식
      days.push({
        date: new Date(d),
        value: taskCountByDate.get(dateKey) || 0,
      });
    }
    return days;
  }, [dailyTaskCounts]);

  const weeks = useMemo(() => {
    const weeksArray: DayData[][] = [];
    let currentWeek: DayData[] = [];

    // 첫 날의 요일을 구해서 빈 칸 채우기
    const firstDay = yearData[0];
    const firstDayOfWeek = firstDay.date.getDay();

    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: new Date(0), value: -1 });
    }

    yearData.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: new Date(0), value: -1 });
      }
      weeksArray.push(currentWeek);
    }

    return weeksArray;
  }, [yearData]);

  return { yearData, weeks };
}
