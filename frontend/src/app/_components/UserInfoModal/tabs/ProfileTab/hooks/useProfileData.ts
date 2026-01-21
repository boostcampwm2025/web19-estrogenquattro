import { useMemo } from "react";
import { usePoint, useFocustime, useGithubEvents } from "@/lib/api/hooks";
import { DailyFocusTimeRes, GithubEventsRes } from "@/lib/api";
import { DailyTaskCount } from "../components/CalendarHeatmap/useHeatmapData";
import { toDateString } from "@/utils/timeFormat";

interface UseProfileDataReturn {
  dailyTaskCounts: DailyTaskCount[];
  focusTimeData: DailyFocusTimeRes | undefined;
  githubEvents: GithubEventsRes | undefined;
  isLoading: boolean;
  isDateDataLoading: boolean;
}

export function useProfileData(
  playerId: number,
  selectedDate: Date,
): UseProfileDataReturn {
  const dateStr = toDateString(selectedDate);

  // 히트맵 데이터 (1년치 포인트)
  const { points, isLoading: isPointsLoading } = usePoint();

  // 선택된 날짜의 집중시간
  const { focustime: focusTimeData, isLoading: isFocusLoading } = useFocustime(
    playerId,
    dateStr,
  );

  // 선택된 날짜의 GitHub 이벤트
  const { events: githubEvents, isLoading: isGithubLoading } =
    useGithubEvents(dateStr);

  const dailyTaskCounts: DailyTaskCount[] = useMemo(() => {
    return points.map((point) => ({
      date: point.createdDate,
      taskCount: point.amount,
    }));
  }, [points]);

  return {
    dailyTaskCounts,
    focusTimeData,
    githubEvents,
    isLoading: isPointsLoading,
    isDateDataLoading: isFocusLoading || isGithubLoading,
  };
}
