/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { guestbookApi } from "@/lib/api/guestbook";
import {
  useCreateGuestbook,
  useDeleteGuestbook,
  useGuestbookEntries,
  useGuestbookReadState,
  useMarkGuestbookAsRead,
} from "@/lib/api/hooks/useGuestbook";
import { queryKeys } from "@/lib/api/hooks/queryKeys";
import {
  failNextMarkAsRead,
  resetGuestbookStore,
  seedGuestbookEntries,
  setGuestbookReadState,
} from "@test/mocks/handlers/guestbook";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("Guestbook API 통합", () => {
  beforeEach(() => {
    resetGuestbookStore();
    seedGuestbookEntries([
      {
        id: 1,
        content: "첫 방명록",
        createdAt: "2026-03-17T00:00:00.000Z",
        player: { id: 1, nickname: "alice" },
      },
      {
        id: 2,
        content: "두 번째 방명록",
        createdAt: "2026-03-16T00:00:00.000Z",
        player: { id: 2, nickname: "bob" },
      },
    ]);
    setGuestbookReadState({
      latestEntryId: 2,
      lastReadEntryId: 0,
      hasUnread: true,
    });
  });

  it("guestbookApi.getEntries는 cursor와 limit을 적용한다", async () => {
    const result = await guestbookApi.getEntries(2, 1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(1);
  });

  it("useGuestbookEntries는 무한 스크롤 페이지를 조회한다", async () => {
    const { result } = renderHook(() => useGuestbookEntries(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0].items).toHaveLength(2);
  });

  it("생성/삭제 mutation은 guestbook 목록을 invalidate한다", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    const entriesHook = renderHook(() => useGuestbookEntries(true), { wrapper });
    const createHook = renderHook(() => useCreateGuestbook(), { wrapper });
    const deleteHook = renderHook(() => useDeleteGuestbook(), { wrapper });

    await waitFor(() => {
      expect(entriesHook.result.current.isSuccess).toBe(true);
    });

    await act(async () => {
      await createHook.result.current.mutateAsync("새 방명록");
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: queryKeys.guestbook.all,
        }),
      );
    });

    const createdList = await guestbookApi.getEntries();
    expect(createdList.items[0].content).toBe("새 방명록");

    await act(async () => {
      await deleteHook.result.current.mutateAsync(createdList.items[0].id);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });

    const deletedList = await guestbookApi.getEntries();
    expect(deletedList.items.some((item) => item.content === "새 방명록")).toBe(
      false,
    );
  });

  it("read-state query와 markAsRead mutation은 읽음 상태를 갱신한다", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const readStateHook = renderHook(() => useGuestbookReadState(true), {
      wrapper,
    });
    const markAsReadHook = renderHook(() => useMarkGuestbookAsRead(), {
      wrapper,
    });

    await waitFor(() => {
      expect(readStateHook.result.current.isSuccess).toBe(true);
    });

    expect(readStateHook.result.current.data).toEqual({
      latestEntryId: 2,
      lastReadEntryId: 0,
      hasUnread: true,
    });

    await act(async () => {
      await markAsReadHook.result.current.mutateAsync();
    });

    expect(
      queryClient.getQueryData(queryKeys.guestbook.readState()),
    ).toEqual({
      latestEntryId: 2,
      lastReadEntryId: 2,
      hasUnread: false,
    });
  });

  it("markAsRead 실패 시 이전 read-state로 롤백한다", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(queryKeys.guestbook.readState(), {
      latestEntryId: 2,
      lastReadEntryId: 0,
      hasUnread: true,
    });
    failNextMarkAsRead();

    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    const markAsReadHook = renderHook(() => useMarkGuestbookAsRead(), {
      wrapper,
    });

    await expect(
      markAsReadHook.result.current.mutateAsync(),
    ).rejects.toThrow();

    expect(
      queryClient.getQueryData(queryKeys.guestbook.readState()),
    ).toEqual({
      latestEntryId: 2,
      lastReadEntryId: 0,
      hasUnread: true,
    });
  });
});
