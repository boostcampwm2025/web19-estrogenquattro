import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as authStoreModule from "@/stores/authStore";
import * as guestbookHooksModule from "@/lib/api/hooks/useGuestbook";
import {
  getGuestbookReadMarkerStorageKey,
  markGuestbookEntryAsRead,
} from "@/lib/guestbookUnread";
import { useGuestbookUnreadStatus } from "./useGuestbookUnreadStatus";

vi.mock("@/stores/authStore");
vi.mock("@/lib/api/hooks/useGuestbook", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/hooks/useGuestbook")
  >("@/lib/api/hooks/useGuestbook");

  return {
    ...actual,
    useGuestbookLatestEntry: vi.fn(),
  };
});

const mockUser = {
  githubId: "123",
  username: "testuser",
  avatarUrl: "https://example.com/avatar.png",
  playerId: 1,
};

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("useGuestbookUnreadStatus", () => {
  let currentLatestEntry: { id: number } | null;

  beforeEach(() => {
    currentLatestEntry = null;
    vi.clearAllMocks();

    Object.defineProperty(window, "localStorage", {
      value: createStorageMock(),
      configurable: true,
    });

    vi.mocked(authStoreModule.useAuthStore).mockImplementation((selector) =>
      selector({ user: mockUser } as never),
    );

    vi.mocked(guestbookHooksModule.useGuestbookLatestEntry).mockImplementation(
      () => ({ data: currentLatestEntry }) as never,
    );
  });

  it("unread가 없으면 배지를 표시하지 않는다", () => {
    const { result } = renderHook(() => useGuestbookUnreadStatus());

    expect(result.current.hasUnread).toBe(false);
    expect(result.current.latestEntryId).toBeNull();
  });

  it("새 항목이 있으면 unread가 되고 읽음 처리 후 사라진다", async () => {
    currentLatestEntry = { id: 10 };

    const { result } = renderHook(() => useGuestbookUnreadStatus());

    await waitFor(() => {
      expect(result.current.hasUnread).toBe(true);
    });

    act(() => {
      result.current.markAsRead();
    });

    expect(result.current.hasUnread).toBe(false);
    expect(
      window.localStorage.getItem(
        getGuestbookReadMarkerStorageKey(mockUser.playerId),
      ),
    ).toBe("10");
  });

  it("같은 탭에서 읽음 이벤트가 발생하면 상태가 즉시 동기화된다", async () => {
    currentLatestEntry = { id: 10 };

    const { result } = renderHook(() => useGuestbookUnreadStatus());

    await waitFor(() => {
      expect(result.current.hasUnread).toBe(true);
    });

    act(() => {
      markGuestbookEntryAsRead(mockUser.playerId, 10);
    });

    await waitFor(() => {
      expect(result.current.hasUnread).toBe(false);
    });
  });

  it("읽은 뒤 더 최신 항목이 생기면 다시 unread가 된다", async () => {
    currentLatestEntry = { id: 10 };

    const { result, unmount } = renderHook(() => useGuestbookUnreadStatus());

    await waitFor(() => {
      expect(result.current.hasUnread).toBe(true);
    });

    act(() => {
      result.current.markAsRead();
    });

    expect(result.current.hasUnread).toBe(false);

    unmount();
    currentLatestEntry = { id: 10 };

    const remounted = renderHook(() => useGuestbookUnreadStatus());

    await waitFor(() => {
      expect(remounted.result.current.hasUnread).toBe(false);
    });

    currentLatestEntry = { id: 11 };
    remounted.rerender();

    await waitFor(() => {
      expect(remounted.result.current.hasUnread).toBe(true);
    });
  });
});
