import { useMemo } from "react";
import {
  usePoint,
  useFocustime,
  useGithubEvents,
  useTasks,
} from "@/lib/api/hooks";
import { DailyFocusTimeRes, GithubEventsRes } from "@/lib/api";
import { toDateString, toUTCDateString } from "@/utils/timeFormat";
import { Task, mapTaskResToTask } from "@/app/_components/TasksMenu/types";
import { DailyPoints } from "../components/CalendarHeatmap/useHeatmapData";

interface UseProfileDataReturn {
  dailyPoints: DailyPoints;
  focusTimeData: DailyFocusTimeRes | undefined;
  githubEvents: GithubEventsRes | undefined;
  tasks: Task[];
  isLoading: boolean;
  isDateDataLoading: boolean;
}

export function useProfileData(
  playerId: number,
  selectedDate: Date,
): UseProfileDataReturn {
  const dateStr = toDateString(selectedDate);

  // 히트맵 데이터 (1년치 포인트)
  const { points, isLoading: isPointsLoading } = usePoint(playerId);

  // 선택된 날짜의 집중시간
  const { focustime: focusTimeData, isLoading: isFocusLoading } = useFocustime(
    playerId,
    dateStr,
  );

  // 선택된 날짜의 GitHub 이벤트
  const { events: githubEvents, isLoading: isGithubLoading } = useGithubEvents(
    playerId,
    dateStr,
  );

  // 선택된 날짜의 Task 목록
  const { tasks: tasksData, isLoading: isTasksLoading } = useTasks(
    playerId,
    dateStr,
  );

  const tasks: Task[] = useMemo(() => {
    return tasksData.map(mapTaskResToTask);
  }, [tasksData]);

  const dailyPoints: DailyPoints = useMemo(() => {
    const map = new Map<string, number>();
    points.forEach((point) => {
      const dateKey = toUTCDateString(new Date(point.createdAt));
      map.set(dateKey, point.amount);
    });
    return map;
  }, [points]);

  return {
    dailyPoints,
    focusTimeData,
    githubEvents,
    tasks,
    isLoading: isPointsLoading,
    isDateDataLoading: isFocusLoading || isGithubLoading || isTasksLoading,
  };
}
