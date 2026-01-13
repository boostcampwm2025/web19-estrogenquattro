import { useMemo } from "react";
import { Task } from "@/app/_components/TasksMenu/types";

export interface DayData {
  date: Date;
  value: number;
}

interface UseHeatmapDataResult {
  yearData: DayData[];
  weeks: DayData[][];
}

export function useHeatmapData(tasks: Task[]): UseHeatmapDataResult {
  const yearData = useMemo(() => {
    const taskCountByDate = new Map<string, number>();

    tasks.forEach((task) => {
      if (task.date) {
        const dateKey = task.date.toDateString();
        taskCountByDate.set(dateKey, (taskCountByDate.get(dateKey) || 0) + 1);
      }
    });

    const days: DayData[] = [];
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toDateString();
      days.push({
        date: new Date(d),
        value: taskCountByDate.get(dateKey) || 0,
      });
    }
    return days;
  }, [tasks]);

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
