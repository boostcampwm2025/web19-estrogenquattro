/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POINT_TYPES } from "@/lib/api/constants/constants";
import { useLeaderboard } from "@/lib/api/hooks/useLeaderboard";
import { server } from "@test/mocks/server";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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

describe("useLeaderboard 통합", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ALL 타입이면 전체 포인트 랭킹 API를 조회한다", async () => {
    const getRanksSpy = vi.fn();
    server.use(
      http.get("*/api/points/ranks", () => {
        getRanksSpy();
        return HttpResponse.json([
          { playerId: 1, nickname: "alice", totalPoints: 20, rank: 1 },
        ]);
      }),
    );

    const { result } = renderHook(
      () => useLeaderboard("2026-03-10T00:00:00.000Z", POINT_TYPES.ALL),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getRanksSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isAllType).toBe(true);
    expect(result.current.ranks[0]).toMatchObject({ nickname: "alice" });
  });

  it("활동 타입이면 history-ranks API를 조회한다", async () => {
    const getHistoryRanksSpy = vi.fn();
    server.use(
      http.get("*/api/history-ranks", () => {
        getHistoryRanksSpy();
        return HttpResponse.json([
          { playerId: 2, nickname: "bob", count: 3, rank: 1 },
        ]);
      }),
    );

    const { result } = renderHook(
      () => useLeaderboard("2026-03-10T00:00:00.000Z", POINT_TYPES.COMMITTED),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getHistoryRanksSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isAllType).toBe(false);
    expect(result.current.ranks[0]).toMatchObject({ nickname: "bob" });
  });

  it("enabled=false면 요청하지 않고 빈 배열을 반환한다", async () => {
    const getRanksSpy = vi.fn();
    server.use(
      http.get("*/api/points/ranks", () => {
        getRanksSpy();
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(
      () => useLeaderboard("2026-03-10T00:00:00.000Z", POINT_TYPES.ALL, false),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getRanksSpy).not.toHaveBeenCalled();
    expect(result.current.ranks).toEqual([]);
  });
});
