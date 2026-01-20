import { useState, useEffect, useMemo } from "react";
import {
  pointApi,
  focustimeApi,
  DailyPointRes,
  DailyFocusTimeRes,
} from "@/lib/api";
import { DailyTaskCount } from "../components/CalendarHeatmap/useHeatmapData";

interface UseProfileDataReturn {
  dailyTaskCounts: DailyTaskCount[];
  focusTimeData: DailyFocusTimeRes | null;
  isLoading: boolean;
}

export function useProfileData(): UseProfileDataReturn {
  const [pointsData, setPointsData] = useState<DailyPointRes[]>([]);
  const [focusTimeData, setFocusTimeData] = useState<DailyFocusTimeRes | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      try {
        const [points, focusTime] = await Promise.all([
          pointApi.getPoints(),
          focustimeApi.getFocusTime(todayStr),
        ]);
        setPointsData(points);
        setFocusTimeData(focusTime);
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfileData();
  }, []);

  const dailyTaskCounts: DailyTaskCount[] = useMemo(() => {
    return pointsData.map((point) => ({
      date: point.createdDate,
      taskCount: point.amount,
    }));
  }, [pointsData]);

  return { dailyTaskCounts, focusTimeData, isLoading };
}
