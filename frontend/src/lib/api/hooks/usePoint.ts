"use client";

import { useQuery } from "@tanstack/react-query";
import { pointApi } from "../point";
import { queryKeys } from "./queryKeys";

export function usePoint(targetPlayerId: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.points.list(targetPlayerId),
    queryFn: () => pointApi.getPoints(targetPlayerId, new Date().toISOString()),
    enabled: targetPlayerId > 0,
    staleTime: 0,
  });

  return {
    points: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
