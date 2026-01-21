"use client";

import { useQuery } from "@tanstack/react-query";
import { githubApi } from "../github";
import { queryKeys } from "./queryKeys";

export function useGithubEvents(date: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.github.events(date),
    queryFn: () => githubApi.getEvents(date),
    enabled: !!date,
  });

  return {
    events: data,
    isLoading,
    error,
    refetch,
  };
}
