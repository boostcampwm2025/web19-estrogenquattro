import { useState, useEffect, useMemo } from "react";
import {
  pointApi,
  focustimeApi,
  DailyPointRes,
  DailyFocusTimeRes,
} from "@/lib/api";
import { DailyTaskCount } from "../components/CalendarHeatmap/useHeatmapData";
import { toDateString } from "@/utils/timeFormat";

interface UseProfileDataReturn {
  dailyTaskCounts: DailyTaskCount[];
  focusTimeData: DailyFocusTimeRes | null;
  isLoading: boolean;
  isFocusTimeLoading: boolean;
}

export function useProfileData(selectedDate: Date): UseProfileDataReturn {
  const [pointsData, setPointsData] = useState<DailyPointRes[]>([]);
  const [focusTimeData, setFocusTimeData] = useState<DailyFocusTimeRes | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isFocusTimeLoading, setIsFocusTimeLoading] = useState(false);

  // 초기 로딩: 히트맵 데이터 (1년치 포인트)
  useEffect(() => {
    const fetchHeatmapData = async () => {
      try {
        const points = await pointApi.getPoints();
        setPointsData(points);
      } catch (error) {
        console.error("Failed to fetch heatmap data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHeatmapData();
  }, []);

  // 선택된 날짜가 바뀔 때마다 집중시간 조회
  useEffect(() => {
    const fetchFocusTime = async () => {
      const dateStr = toDateString(selectedDate);
      setIsFocusTimeLoading(true);
      try {
        const focusTime = await focustimeApi.getFocusTime(dateStr);
        setFocusTimeData(focusTime);
      } catch (error) {
        console.error("Failed to fetch focus time:", error);
        setFocusTimeData(null);
      } finally {
        setIsFocusTimeLoading(false);
      }
    };
    fetchFocusTime();
  }, [selectedDate]);

  const dailyTaskCounts: DailyTaskCount[] = useMemo(() => {
    return pointsData.map((point) => ({
      date: point.createdDate,
      taskCount: point.amount,
    }));
  }, [pointsData]);

  return { dailyTaskCounts, focusTimeData, isLoading, isFocusTimeLoading };
}
