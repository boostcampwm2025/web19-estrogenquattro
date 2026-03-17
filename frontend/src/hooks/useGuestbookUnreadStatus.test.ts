import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as authStoreModule from "@/stores/authStore";
import * as guestbookHooksModule from "@/lib/api/hooks/useGuestbook";
import { useGuestbookUnreadStatus } from "./useGuestbookUnreadStatus";

vi.mock("@/stores/authStore");
vi.mock("@/lib/api/hooks/useGuestbook", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/hooks/useGuestbook")
  >("@/lib/api/hooks/useGuestbook");

  return {
    ...actual,
    useGuestbookReadState: vi.fn(),
    useMarkGuestbookAsRead: vi.fn(),
  };
});

const mockUser = {
  githubId: "123",
  username: "testuser",
  avatarUrl: "https://example.com/avatar.png",
  playerId: 1,
};

describe("useGuestbookUnreadStatus", () => {
  const mockMutateAsync = vi.fn();
  let currentReadState:
    | {
        latestEntryId: number | null;
        lastReadEntryId: number;
        hasUnread: boolean;
      }
    | undefined;

  beforeEach(() => {
    currentReadState = undefined;
    mockMutateAsync.mockReset();
    vi.clearAllMocks();

    vi.mocked(authStoreModule.useAuthStore).mockImplementation((selector) =>
      selector({ user: mockUser } as never),
    );

    vi.mocked(guestbookHooksModule.useGuestbookReadState).mockImplementation(
      () => ({ data: currentReadState }) as never,
    );

    vi.mocked(guestbookHooksModule.useMarkGuestbookAsRead).mockImplementation(
      () => ({ mutateAsync: mockMutateAsync }) as never,
    );
  });

  it("read-state가 없으면 unread를 표시하지 않는다", () => {
    const { result } = renderHook(() => useGuestbookUnreadStatus());

    expect(result.current.hasUnread).toBe(false);
    expect(result.current.latestEntryId).toBeNull();
  });

  it("read-state가 아직 없어도 markAsRead를 호출한다", async () => {
    const { result } = renderHook(() => useGuestbookUnreadStatus());

    await act(async () => {
      await result.current.markAsRead();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("서버 read-state에 unread가 있으면 배지를 표시한다", () => {
    currentReadState = {
      latestEntryId: 10,
      lastReadEntryId: 5,
      hasUnread: true,
    };

    const { result } = renderHook(() => useGuestbookUnreadStatus());

    expect(result.current.hasUnread).toBe(true);
    expect(result.current.latestEntryId).toBe(10);
  });

  it("unread가 있을 때 markAsRead를 호출하면 서버 mutation을 실행한다", async () => {
    currentReadState = {
      latestEntryId: 10,
      lastReadEntryId: 5,
      hasUnread: true,
    };

    const { result } = renderHook(() => useGuestbookUnreadStatus());

    await act(async () => {
      await result.current.markAsRead();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("최신 방명록이 있으면 cached unread가 false여도 markAsRead를 호출한다", async () => {
    currentReadState = {
      latestEntryId: 10,
      lastReadEntryId: 10,
      hasUnread: false,
    };

    const { result } = renderHook(() => useGuestbookUnreadStatus());

    await act(async () => {
      await result.current.markAsRead();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("player가 없으면 markAsRead를 호출하지 않는다", async () => {
    vi.mocked(authStoreModule.useAuthStore).mockImplementation((selector) =>
      selector({ user: null } as never),
    );
    const { result } = renderHook(() => useGuestbookUnreadStatus());

    await act(async () => {
      await result.current.markAsRead();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
