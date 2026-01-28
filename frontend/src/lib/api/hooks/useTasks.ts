"use client";

import { useQuery } from "@tanstack/react-query";
import { taskApi } from "../task";
import { queryKeys } from "./queryKeys";
import { getLocalDayRange, parseLocalDate } from "@/utils/timeFormat";

export function useTasks(playerId: number, date?: string) {
  // date가 없으면 오늘 로컬 날짜로 기본 설정
  const dateObj = date ? parseLocalDate(date) : new Date();
  const { startAt, endAt } = getLocalDayRange(dateObj);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.tasks.list(playerId, date),
    queryFn: () => taskApi.getTasks(playerId, startAt, endAt),
    enabled: playerId > 0,
    staleTime: 0,
  });

  return {
    tasks: data?.tasks ?? [],
    isLoading,
    error,
    refetch,
  };
}
