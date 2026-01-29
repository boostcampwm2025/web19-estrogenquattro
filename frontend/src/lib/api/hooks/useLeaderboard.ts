"use client";

import { useQuery } from "@tanstack/react-query";
import { pointApi } from "../point";
import { queryKeys } from "./queryKeys";

export function useLeaderboard(weekendStartAt: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.leaderboard.ranks(weekendStartAt),
    queryFn: () => pointApi.getRanks(weekendStartAt),
    staleTime: 0,
  });

  return {
    ranks: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
