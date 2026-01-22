"use client";

import { useQuery } from "@tanstack/react-query";
import { taskApi } from "../task";
import { queryKeys } from "./queryKeys";

export function useTasks(playerId: number, date?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.tasks.list(playerId, date),
    queryFn: () => taskApi.getTasks(playerId, date),
    enabled: playerId > 0,
    staleTime: 0,
    refetchOnMount: "always",
  });

  return {
    tasks: data?.tasks ?? [],
    isLoading,
    error,
    refetch,
  };
}
