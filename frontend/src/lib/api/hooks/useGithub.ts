"use client";

import { useQuery } from "@tanstack/react-query";
import { githubApi } from "../github";
import { queryKeys } from "./queryKeys";
import { getLocalDayRange, parseLocalDate } from "@/utils/timeFormat";

export function useGithubEvents(playerId: number, date: string) {
  // YYYY-MM-DD 문자열을 로컬 타임존 Date 객체로 변환 후 로컬 날짜 범위로 변환
  const dateObj = parseLocalDate(date);
  const { startAt, endAt } = getLocalDayRange(dateObj);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.github.events(playerId, date),
    queryFn: () => githubApi.getEvents(playerId, startAt, endAt),
    enabled: playerId > 0 && !!date,
    staleTime: 0,
  });

  return {
    events: data,
    isLoading,
    error,
    refetch,
  };
}

export function useGithubUser(username: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.github.user(username),
    queryFn: () => githubApi.getUser(username),
    enabled: !!username,
    staleTime: 0,
  });

  return {
    user: data,
    isLoading,
    error,
  };
}





export function useFollowStatus(username: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.github.followStatus(username),
    queryFn: () => githubApi.getFollowStatus(username),
    enabled: !!username,
    staleTime: 0,
  });

  return {
    isFollowing: data?.isFollowing ?? false,
    isLoading,
    error,
  };
}


