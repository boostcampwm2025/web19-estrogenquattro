import { useState, useEffect, useMemo } from "react";
import {
  pointApi,
  focustimeApi,
  githubApi,
  DailyPointRes,
  DailyFocusTimeRes,
  GithubEventsRes,
} from "@/lib/api";
import { DailyTaskCount } from "../components/CalendarHeatmap/useHeatmapData";
import { toDateString } from "@/utils/timeFormat";

interface UseProfileDataReturn {
  dailyTaskCounts: DailyTaskCount[];
  focusTimeData: DailyFocusTimeRes | null;
  githubEvents: GithubEventsRes | null;
  isLoading: boolean;
  isDateDataLoading: boolean;
}

export function useProfileData(
  playerId: number,
  selectedDate: Date,
): UseProfileDataReturn {
  const [pointsData, setPointsData] = useState<DailyPointRes[]>([]);
  const [focusTimeData, setFocusTimeData] = useState<DailyFocusTimeRes | null>(
    null,
  );
  const [githubEvents, setGithubEvents] = useState<GithubEventsRes | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDateDataLoading, setIsDateDataLoading] = useState(false);

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

  // 선택된 날짜가 바뀔 때마다 집중시간 + GitHub 이벤트 조회
  useEffect(() => {
    const fetchDateData = async () => {
      const dateStr = toDateString(selectedDate);
      setIsDateDataLoading(true);
      try {
        const [focusTime, events] = await Promise.all([
          focustimeApi.getFocusTime(playerId, dateStr),
          githubApi.getEvents(dateStr),
        ]);
        setFocusTimeData(focusTime);
        setGithubEvents(events);
      } catch (error) {
        console.error("Failed to fetch date data:", error);
        setFocusTimeData(null);
        setGithubEvents(null);
      } finally {
        setIsDateDataLoading(false);
      }
    };
    fetchDateData();
  }, [playerId, selectedDate]);

  const dailyTaskCounts: DailyTaskCount[] = useMemo(() => {
    return pointsData.map((point) => ({
      date: point.createdDate,
      taskCount: point.amount,
    }));
  }, [pointsData]);

  return {
    dailyTaskCounts,
    focusTimeData,
    githubEvents,
    isLoading,
    isDateDataLoading,
  };
}
