"use client";

import { useQuery } from "@tanstack/react-query";
import { pointApi } from "../point";
import { queryKeys } from "./queryKeys";
import { getLocalDayRange, toDateString } from "@/utils/timeFormat";

export function useGitEventHistories(playerId: number, selectedDate: Date) {
  const dateStr = toDateString(selectedDate);
  const { startAt, endAt } = getLocalDayRange(selectedDate);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.points.gitEventHistories(playerId, dateStr),
    queryFn: () => pointApi.getGitEventHistories(playerId, startAt, endAt),
    enabled: !!playerId,
    staleTime: 0,
  });

  return {
    gitEvents: data ?? [],
    isLoading,
    error,
  };
}
