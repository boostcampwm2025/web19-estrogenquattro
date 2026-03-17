import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as modalStoreModule from "@/stores/useModalStore";
import * as unreadHookModule from "@/hooks/useGuestbookUnreadStatus";
import { MODAL_TYPES, type ModalType } from "@/stores/useModalStore";
import GuestbookButton from "./GuestbookButton";

vi.mock("@/stores/useModalStore");
vi.mock("@/hooks/useGuestbookUnreadStatus");

describe("GuestbookButton", () => {
  const mockToggleModal = vi.fn();
  const mockMarkAsRead = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(modalStoreModule.useModalStore).mockImplementation((selector) =>
      selector({
        activeModal: null as ModalType,
        userInfoPayload: null,
        openModal: vi.fn(),
        closeModal: vi.fn(),
        toggleModal: mockToggleModal,
      } as never),
    );

    vi.mocked(unreadHookModule.useGuestbookUnreadStatus).mockReturnValue({
      hasUnread: false,
      latestEntryId: null,
      markAsRead: mockMarkAsRead,
    });
  });

  it("unread가 없으면 빨간 점 없이 기존 접근성 라벨을 유지한다", () => {
    render(<GuestbookButton />);

    expect(
      screen.getByRole("button", { name: "방명록 열기" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("guestbook-unread-badge")).toBeNull();
  });

  it("unread가 있으면 빨간 점을 표시하고 클릭 시 읽음 처리 후 모달을 연다", async () => {
    vi.mocked(unreadHookModule.useGuestbookUnreadStatus).mockReturnValue({
      hasUnread: true,
      latestEntryId: 10,
      markAsRead: mockMarkAsRead,
    });
    const user = userEvent.setup();

    render(<GuestbookButton />);

    expect(screen.getByTestId("guestbook-unread-badge")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "방명록 열기" }));

    expect(mockMarkAsRead).toHaveBeenCalledTimes(1);
    expect(mockToggleModal).toHaveBeenCalledWith(MODAL_TYPES.GUESTBOOK);
  });
});
