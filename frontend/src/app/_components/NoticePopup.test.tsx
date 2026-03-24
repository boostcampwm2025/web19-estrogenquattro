import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoticePopup from "./NoticePopup";

const mockShowNotice = vi.fn();
const mockDismiss = vi.fn();

let storeState = {
  notice: null as null | {
    id: number;
    ko: { title: string; content: string };
    en: { title: string; content: string };
    createdAt: string;
  },
  isOpen: false,
  showNotice: mockShowNotice,
  dismiss: mockDismiss,
};

vi.mock("@/stores/useNoticePopupStore", () => ({
  useNoticePopupStore: (selector: (s: typeof storeState) => unknown) =>
    selector(storeState),
}));

vi.mock("@/lib/api/notice", () => ({
  getNewNotice: vi.fn().mockResolvedValue(null),
  markNoticeAsRead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/socket", () => ({
  getSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

vi.mock("./MarkdownRenderer", () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

const sampleNotice = {
  id: 1,
  ko: { title: "공지 제목", content: "공지 내용" },
  en: { title: "Notice Title", content: "Notice Content" },
  createdAt: "2026-03-20T00:00:00Z",
};

describe("NoticePopup", () => {
  beforeEach(() => {
    storeState = {
      notice: null,
      isOpen: false,
      showNotice: mockShowNotice,
      dismiss: mockDismiss,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("isOpen이 false이면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<NoticePopup />);
    expect(container.innerHTML).toBe("");
  });

  it("isOpen이 true이면 공지 팝업을 렌더링한다", () => {
    storeState.isOpen = true;
    storeState.notice = sampleNotice;

    render(<NoticePopup />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("공지 제목")).toBeInTheDocument();
    expect(screen.getByText("공지 내용")).toBeInTheDocument();
  });

  it("확인 버튼 클릭 시 dismiss가 호출된다", async () => {
    storeState.isOpen = true;
    storeState.notice = sampleNotice;
    const user = userEvent.setup();

    render(<NoticePopup />);

    await user.click(screen.getByText("확인"));
    expect(mockDismiss).toHaveBeenCalledOnce();
  });

  it("배경 클릭 시 dismiss가 호출된다", async () => {
    storeState.isOpen = true;
    storeState.notice = sampleNotice;
    const user = userEvent.setup();

    render(<NoticePopup />);

    const backdrop = screen.getByRole("dialog").parentElement!;
    await user.click(backdrop);
    expect(mockDismiss).toHaveBeenCalled();
  });

  it("dialog 내부 클릭 시 dismiss가 호출되지 않는다", async () => {
    storeState.isOpen = true;
    storeState.notice = sampleNotice;
    const user = userEvent.setup();

    render(<NoticePopup />);

    await user.click(screen.getByRole("dialog"));
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it("ESC 키 입력 시 dismiss가 호출된다", async () => {
    storeState.isOpen = true;
    storeState.notice = sampleNotice;
    const user = userEvent.setup();

    render(<NoticePopup />);

    await user.keyboard("{Escape}");
    expect(mockDismiss).toHaveBeenCalledOnce();
  });
});
