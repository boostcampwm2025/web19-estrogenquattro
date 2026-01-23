"use client";

import { useQuery } from "@tanstack/react-query";
import { pointApi } from "../point";
import { queryKeys } from "./queryKeys";

export function usePoint() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.points.list(),
    queryFn: pointApi.getPoints,
    staleTime: 0,
  });

  return {
    points: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
