import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as authStoreModule from "@/stores/authStore";
import * as guestbookHooksModule from "@/lib/api/hooks/useGuestbook";
import * as modalStoreModule from "@/stores/useModalStore";
import { MODAL_TYPES, type ModalType } from "@/stores/useModalStore";
import { getGuestbookReadMarkerStorageKey } from "@/lib/guestbookUnread";
import GuestbookButton from "./GuestbookButton";

vi.mock("@/stores/authStore");
vi.mock("@/stores/useModalStore");
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

describe("GuestbookButton", () => {
  const mockToggleModal = vi.fn();
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

    vi.mocked(modalStoreModule.useModalStore).mockImplementation((selector) =>
      selector({
        activeModal: null as ModalType,
        userInfoPayload: null,
        openModal: vi.fn(),
        closeModal: vi.fn(),
        toggleModal: mockToggleModal,
      } as never),
    );

    vi.mocked(guestbookHooksModule.useGuestbookLatestEntry).mockImplementation(
      () => ({ data: currentLatestEntry }) as never,
    );
  });

  it("unread가 없으면 빨간 점 없이 기존 접근성 라벨을 유지한다", () => {
    render(<GuestbookButton />);

    expect(
      screen.getByRole("button", { name: "방명록 열기" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("guestbook-unread-badge")).toBeNull();
  });

  it("unread가 있으면 빨간 점을 표시하고 클릭 시 읽음 처리 후 모달을 연다", async () => {
    currentLatestEntry = { id: 10 };
    const user = userEvent.setup();

    render(<GuestbookButton />);

    const button = screen.getByRole("button", { name: "방명록 열기" });

    await waitFor(() => {
      expect(screen.getByTestId("guestbook-unread-badge")).toBeInTheDocument();
    });

    await user.click(button);

    expect(mockToggleModal).toHaveBeenCalledWith(MODAL_TYPES.GUESTBOOK);
    expect(
      window.localStorage.getItem(
        getGuestbookReadMarkerStorageKey(mockUser.playerId),
      ),
    ).toBe("10");
    await waitFor(() => {
      expect(screen.queryByTestId("guestbook-unread-badge")).toBeNull();
    });
  });

  it("읽은 뒤 더 최신 항목이 오면 빨간 점이 다시 표시된다", async () => {
    currentLatestEntry = { id: 10 };
    const user = userEvent.setup();

    const { rerender } = render(<GuestbookButton />);

    await user.click(screen.getByRole("button", { name: "방명록 열기" }));

    await waitFor(() => {
      expect(screen.queryByTestId("guestbook-unread-badge")).toBeNull();
    });

    currentLatestEntry = { id: 11 };
    rerender(<GuestbookButton />);

    await waitFor(() => {
      expect(screen.getByTestId("guestbook-unread-badge")).toBeInTheDocument();
    });
  });
});
