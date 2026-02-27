"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { guestbookApi } from "../guestbook";
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
