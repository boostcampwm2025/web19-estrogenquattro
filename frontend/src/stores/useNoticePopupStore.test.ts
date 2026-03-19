import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMarkNoticeAsRead = vi.fn();

vi.mock("@/lib/api/notice", () => ({
  markNoticeAsRead: (...args: unknown[]) => mockMarkNoticeAsRead(...args),
}));

describe("useNoticePopupStore", () => {
  beforeEach(() => {
    vi.resetModules();
    mockMarkNoticeAsRead.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const sampleNotice = {
    id: 1,
    ko: { title: "공지 제목", content: "공지 내용" },
    en: { title: "Notice Title", content: "Notice Content" },
    createdAt: "2026-03-20T00:00:00Z",
  };

  it("초기 상태는 닫혀있고 notice가 null이다", async () => {
    const { useNoticePopupStore } = await import("./useNoticePopupStore");
    const state = useNoticePopupStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.notice).toBeNull();
  });

  it("showNotice 호출 시 notice가 설정되고 팝업이 열린다", async () => {
    const { useNoticePopupStore } = await import("./useNoticePopupStore");

    useNoticePopupStore.getState().showNotice(sampleNotice);

    const state = useNoticePopupStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.notice).toEqual(sampleNotice);
  });

  it("dismiss 호출 시 팝업이 닫히고 notice가 null이 된다", async () => {
    const { useNoticePopupStore } = await import("./useNoticePopupStore");

    useNoticePopupStore.getState().showNotice(sampleNotice);
    useNoticePopupStore.getState().dismiss();

    const state = useNoticePopupStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.notice).toBeNull();
  });

  it("dismiss 시 markNoticeAsRead가 호출된다", async () => {
    const { useNoticePopupStore } = await import("./useNoticePopupStore");

    useNoticePopupStore.getState().showNotice(sampleNotice);
    useNoticePopupStore.getState().dismiss();

    expect(mockMarkNoticeAsRead).toHaveBeenCalledWith(1);
  });

  it("notice가 없는 상태에서 dismiss 시 markNoticeAsRead가 호출되지 않는다", async () => {
    const { useNoticePopupStore } = await import("./useNoticePopupStore");

    useNoticePopupStore.getState().dismiss();

    expect(mockMarkNoticeAsRead).not.toHaveBeenCalled();
  });

  it("showNotice를 여러 번 호출하면 마지막 notice로 덮어씌워진다", async () => {
    const { useNoticePopupStore } = await import("./useNoticePopupStore");

    const secondNotice = { ...sampleNotice, id: 2 };

    useNoticePopupStore.getState().showNotice(sampleNotice);
    useNoticePopupStore.getState().showNotice(secondNotice);

    const state = useNoticePopupStore.getState();
    expect(state.notice?.id).toBe(2);
    expect(state.isOpen).toBe(true);
  });
});
