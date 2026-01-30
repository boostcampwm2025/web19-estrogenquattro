"use client";

import { useQuery } from "@tanstack/react-query";
import { pointApi, type TotalRankRes, type ActivityRankRes } from "../point";
import { queryKeys } from "./queryKeys";
import { POINT_TYPES } from "../constants/constants";

export function useLeaderboard(
  weekendStartAt: string,
  type: string,
  enabled: boolean = true,
) {
  const { data, isLoading, error, refetch } = useQuery<
    TotalRankRes[] | ActivityRankRes[]
  >({
    queryKey: queryKeys.leaderboard.ranks(weekendStartAt, type),
    queryFn: () =>
      type === POINT_TYPES.ALL
        ? pointApi.getRanks(weekendStartAt)
        : pointApi.getHistoryRanks(weekendStartAt, type),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });

  return {
    ranks: data ?? [],
    isLoading,
    error,
    refetch,
    isAllType: type === POINT_TYPES.ALL,
  };
}
