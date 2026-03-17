/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { guestbookApi } from "@/lib/api/guestbook";
import {
  useCreateGuestbook,
  useDeleteGuestbook,
  useGuestbookEntries,
} from "@/lib/api/hooks/useGuestbook";
import { resetGuestbookStore, seedGuestbookEntries } from "@test/mocks/handlers/guestbook";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
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
    const wrapper = createWrapper();
    const createHook = renderHook(() => useCreateGuestbook(), { wrapper });
    const deleteHook = renderHook(() => useDeleteGuestbook(), { wrapper });

    await act(async () => {
      await createHook.result.current.mutateAsync("새 방명록");
    });
    const createdList = await guestbookApi.getEntries();
    expect(createdList.items[0].content).toBe("새 방명록");

    await act(async () => {
      await deleteHook.result.current.mutateAsync(createdList.items[0].id);
    });
    const deletedList = await guestbookApi.getEntries();
    expect(deletedList.items.some((item) => item.content === "새 방명록")).toBe(
      false,
    );
  });
});
