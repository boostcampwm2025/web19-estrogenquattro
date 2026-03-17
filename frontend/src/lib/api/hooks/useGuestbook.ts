"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { guestbookApi, type GuestbookReadStateRes } from "../guestbook";
import { queryKeys } from "./queryKeys";

const PAGE_SIZE = 20;

export function useGuestbookEntries(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.guestbook.list(),
    queryFn: ({ pageParam }) => guestbookApi.getEntries(pageParam, PAGE_SIZE),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

export function useGuestbookReadState(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.guestbook.readState(),
    queryFn: () => guestbookApi.getReadState(),
    enabled,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  });
}

export function useMarkGuestbookAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => guestbookApi.markAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.guestbook.readState(),
      });

      const previousState = queryClient.getQueryData<GuestbookReadStateRes>(
        queryKeys.guestbook.readState(),
      );
      const latestEntryId = previousState?.latestEntryId ?? null;

      if (latestEntryId !== null) {
        queryClient.setQueryData<GuestbookReadStateRes>(
          queryKeys.guestbook.readState(),
          {
            latestEntryId,
            lastReadEntryId: latestEntryId,
            hasUnread: false,
          },
        );
      }

      return { previousState };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousState) {
        queryClient.setQueryData(
          queryKeys.guestbook.readState(),
          context.previousState,
        );
      }
    },
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.guestbook.readState(), state);
    },
  });
}

export function useCreateGuestbook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => guestbookApi.createEntry(content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.guestbook.all,
      });
    },
  });
}

export function useDeleteGuestbook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => guestbookApi.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.guestbook.all,
      });
    },
  });
}
