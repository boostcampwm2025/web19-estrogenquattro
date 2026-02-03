"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { githubApi } from "@/lib/api/github";
import { queryKeys } from "@/lib/api/hooks/queryKeys";

/**
 * 팔로우/언팔로우 mutation 훅 (낙관적 업데이트 포함)
 */
export function useFollowMutation(username: string) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const followMutation = useMutation({
    mutationFn: () => githubApi.followUser(username),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.github.followStatus(username),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.github.user(username),
      });

      const previousStatus = queryClient.getQueryData(
        queryKeys.github.followStatus(username),
      );
      const previousUser = queryClient.getQueryData(
        queryKeys.github.user(username),
      );

      queryClient.setQueryData(queryKeys.github.followStatus(username), {
        isFollowing: true,
      });

      if (previousUser) {
        queryClient.setQueryData(queryKeys.github.user(username), {
          ...previousUser,
          followers: (previousUser as { followers: number }).followers + 1,
        });
      }

      return { previousStatus, previousUser };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.github.followStatus(username),
          context.previousStatus,
        );
      }
      if (context?.previousUser) {
        queryClient.setQueryData(
          queryKeys.github.user(username),
          context.previousUser,
        );
      }
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => githubApi.unfollowUser(username),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.github.followStatus(username),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.github.user(username),
      });

      const previousStatus = queryClient.getQueryData(
        queryKeys.github.followStatus(username),
      );
      const previousUser = queryClient.getQueryData(
        queryKeys.github.user(username),
      );

      queryClient.setQueryData(queryKeys.github.followStatus(username), {
        isFollowing: false,
      });

      if (previousUser) {
        queryClient.setQueryData(queryKeys.github.user(username), {
          ...previousUser,
          followers: Math.max(
            0,
            (previousUser as { followers: number }).followers - 1,
          ),
        });
      }

      return { previousStatus, previousUser };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousStatus) {
        queryClient.setQueryData(
          queryKeys.github.followStatus(username),
          context.previousStatus,
        );
      }
      if (context?.previousUser) {
        queryClient.setQueryData(
          queryKeys.github.user(username),
          context.previousUser,
        );
      }
    },
  });

  const handleFollowToggle = async (isCurrentlyFollowing: boolean) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (isCurrentlyFollowing) {
        await unfollowMutation.mutateAsync();
      } else {
        await followMutation.mutateAsync();
      }
    } catch (error) {
      console.error("팔로우 상태 변경 실패:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleFollowToggle,
    isSubmitting,
  };
}
