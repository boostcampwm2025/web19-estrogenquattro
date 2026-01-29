"use client";

import { useQuery } from "@tanstack/react-query";
import { focustimeApi } from "../focustime";
import { queryKeys } from "./queryKeys";
import { getLocalDayRange, parseLocalDate } from "@/utils/timeFormat";

export function useFocustime(playerId: number, date: string) {
  // YYYY-MM-DD 문자열을 로컬 타임존 Date 객체로 변환 후 로컬 날짜 범위로 변환
  const dateObj = parseLocalDate(date);
  const { startAt, endAt } = getLocalDayRange(dateObj);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.focustime.detail(playerId, date),
    queryFn: () => focustimeApi.getFocusTime(playerId, startAt, endAt),
    enabled: playerId > 0 && !!date,
    staleTime: 0,
  });

  return {
    focustime: data,
    isLoading,
    error,
    refetch,
  };
}
