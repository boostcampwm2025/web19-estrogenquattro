import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProfileData } from "./useProfileData";
import * as apiHooks from "@/lib/api/hooks";
import { DailyPointRes } from "@/lib/api/point";
import { TaskRes } from "@/lib/api";

// API 훅들을 모킹
vi.mock("@/lib/api/hooks");

describe("useProfileData", () => {
  const mockPlayerId = 123;
  const mockSelectedDate = new Date(2026, 0, 29);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("포인트 데이터를 DailyPoints Map으로 변환한다", () => {
    const mockPoints: DailyPointRes[] = [
      { id: 1, amount: 10, createdAt: "2026-01-27T10:00:00.000Z" },
      { id: 2, amount: 20, createdAt: "2026-01-28T10:00:00.000Z" },
      { id: 3, amount: 15, createdAt: "2026-01-29T10:00:00.000Z" },
    ];

    vi.mocked(apiHooks.usePoint).mockReturnValue({
      points: mockPoints,
      isLoading: false,
    });
    vi.mocked(apiHooks.useFocustime).mockReturnValue({
      focustime: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useGithubEvents).mockReturnValue({
      events: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useTasks).mockReturnValue({
      tasks: [],
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useProfileData(mockPlayerId, mockSelectedDate),
    );

    expect(result.current.dailyPoints.size).toBe(3);
    expect(result.current.dailyPoints.get("2026-01-27")).toBe(10);
    expect(result.current.dailyPoints.get("2026-01-28")).toBe(20);
    expect(result.current.dailyPoints.get("2026-01-29")).toBe(15);
  });

  it("TaskRes를 Task로 변환한다", () => {
    const mockTasksData: TaskRes[] = [
      {
        id: 1,
        description: "할 일 1",
        isCompleted: false,
        createdAt: "2026-01-29T10:00:00.000Z",
        totalFocusSeconds: 0,
      },
      {
        id: 2,
        description: "할 일 2",
        isCompleted: true,
        createdAt: "2026-01-29T11:00:00.000Z",
        totalFocusSeconds: 1800,
      },
    ];

    vi.mocked(apiHooks.usePoint).mockReturnValue({
      points: [],
      isLoading: false,
    });
    vi.mocked(apiHooks.useFocustime).mockReturnValue({
      focustime: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useGithubEvents).mockReturnValue({
      events: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useTasks).mockReturnValue({
      tasks: mockTasksData,
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useProfileData(mockPlayerId, mockSelectedDate),
    );

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks[0]).toMatchObject({
      id: 1,
      description: "할 일 1",
      completed: false,
      time: 0,
      baseTime: 0,
      isRunning: false,
    });
    expect(result.current.tasks[1]).toMatchObject({
      id: 2,
      description: "할 일 2",
      completed: true,
      time: 1800,
      baseTime: 1800,
      isRunning: false,
    });
  });

  it("포인트 로딩 중일 때 isLoading이 true이다", () => {
    vi.mocked(apiHooks.usePoint).mockReturnValue({
      points: [],
      isLoading: true,
    });
    vi.mocked(apiHooks.useFocustime).mockReturnValue({
      focustime: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useGithubEvents).mockReturnValue({
      events: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useTasks).mockReturnValue({
      tasks: [],
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useProfileData(mockPlayerId, mockSelectedDate),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("날짜별 데이터 로딩 중일 때 isDateDataLoading이 true이다", () => {
    vi.mocked(apiHooks.usePoint).mockReturnValue({
      points: [],
      isLoading: false,
    });
    vi.mocked(apiHooks.useFocustime).mockReturnValue({
      focustime: undefined,
      isLoading: true,
    });
    vi.mocked(apiHooks.useGithubEvents).mockReturnValue({
      events: undefined,
      isLoading: true,
    });
    vi.mocked(apiHooks.useTasks).mockReturnValue({
      tasks: [],
      isLoading: true,
    });

    const { result } = renderHook(() =>
      useProfileData(mockPlayerId, mockSelectedDate),
    );

    expect(result.current.isDateDataLoading).toBe(true);
  });

  it("모든 데이터가 로드되면 isDateDataLoading이 false이다", () => {
    vi.mocked(apiHooks.usePoint).mockReturnValue({
      points: [],
      isLoading: false,
    });
    vi.mocked(apiHooks.useFocustime).mockReturnValue({
      focustime: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useGithubEvents).mockReturnValue({
      events: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useTasks).mockReturnValue({
      tasks: [],
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useProfileData(mockPlayerId, mockSelectedDate),
    );

    expect(result.current.isDateDataLoading).toBe(false);
  });

  it("focusTimeData와 githubEvents를 그대로 반환한다", () => {
    const mockFocusTime = {
      totalFocusSeconds: 3600,
      date: "2026-01-29",
    };
    const mockGithubEvents = {
      committed: 5,
      issueOpened: 2,
      prCreated: 1,
      prReviewed: 3,
    };

    vi.mocked(apiHooks.usePoint).mockReturnValue({
      points: [],
      isLoading: false,
    });
    vi.mocked(apiHooks.useFocustime).mockReturnValue({
      focustime: mockFocusTime,
      isLoading: false,
    });
    vi.mocked(apiHooks.useGithubEvents).mockReturnValue({
      events: mockGithubEvents,
      isLoading: false,
    });
    vi.mocked(apiHooks.useTasks).mockReturnValue({
      tasks: [],
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useProfileData(mockPlayerId, mockSelectedDate),
    );

    expect(result.current.focusTimeData).toEqual(mockFocusTime);
    expect(result.current.githubEvents).toEqual(mockGithubEvents);
  });

  it("같은 날짜의 포인트는 마지막 값으로 덮어쓴다", () => {
    // 로컬 타임존 기준 같은 날짜
    const mockPoints: DailyPointRes[] = [
      {
        id: 1,
        amount: 10,
        createdAt: new Date(2026, 0, 29, 10, 0, 0).toISOString(),
      },
      {
        id: 2,
        amount: 20,
        createdAt: new Date(2026, 0, 29, 15, 0, 0).toISOString(),
      },
    ];

    vi.mocked(apiHooks.usePoint).mockReturnValue({
      points: mockPoints,
      isLoading: false,
    });
    vi.mocked(apiHooks.useFocustime).mockReturnValue({
      focustime: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useGithubEvents).mockReturnValue({
      events: undefined,
      isLoading: false,
    });
    vi.mocked(apiHooks.useTasks).mockReturnValue({
      tasks: [],
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useProfileData(mockPlayerId, mockSelectedDate),
    );

    // Map.set()은 마지막 값으로 덮어씀
    expect(result.current.dailyPoints.get("2026-01-29")).toBe(20);
  });
});
