"use client";

import { useQuery } from "@tanstack/react-query";
import { githubApi } from "../github";
import { queryKeys } from "./queryKeys";

export function useGithubEvents(playerId: number, date: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.github.events(playerId, date),
    queryFn: () => githubApi.getEvents(playerId, date),
    enabled: !!playerId && !!date,
    staleTime: 0,
  });

  return {
    events: data,
    isLoading,
    error,
    refetch,
  };
}
