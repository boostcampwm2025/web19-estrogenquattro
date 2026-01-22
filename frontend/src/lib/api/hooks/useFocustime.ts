"use client";

import { useQuery } from "@tanstack/react-query";
import { focustimeApi } from "../focustime";
import { queryKeys } from "./queryKeys";

export function useFocustime(playerId: number, date: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.focustime.detail(playerId, date),
    queryFn: () => focustimeApi.getFocusTime(playerId, date),
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
