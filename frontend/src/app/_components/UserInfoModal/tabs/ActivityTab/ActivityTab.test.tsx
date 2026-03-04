import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ActivityTab from "./ActivityTab";
import * as useActivityDataModule from "./hooks/useActivityData";
import { useModalStore } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";

vi.mock("./hooks/useActivityData");
vi.mock("@/stores/useModalStore");
vi.mock("@/stores/authStore");

vi.mock("./components/CalendarHeatmap/CalendarHeatmap", () => ({
  CalendarHeatmap: () => (
    <div data-testid="calendar-heatmap">CalendarHeatmap</div>
  ),
}));

vi.mock("./components/StatsSection/StatsSection", () => ({
  default: () => <div data-testid="stats-section">StatsSection</div>,
}));

vi.mock("./components/DetailSection/DetailSection", () => ({
  default: () => <div data-testid="detail-section">DetailSection</div>,
}));

describe("ActivityTab", () => {
  const mockActivityData = {
    dailyPoints: new Map(),
    focusTimeData: undefined,
    githubEvents: undefined,
    tasks: [],
    isLoading: false,
    isDateDataLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useModalStore).mockImplementation((selector) => {
      const state = {
        activeModal: "userInfo" as const,
        userInfoPayload: { playerId: 1, username: "testuser" },
        openModal: vi.fn(),
        closeModal: vi.fn(),
        toggleModal: vi.fn(),
      };
      return selector(state);
    });
    vi.mocked(useAuthStore).mockImplementation((selector) => {
      const state = {
        user: { playerId: 1, username: "testuser" } as {
          githubId: string;
          username: string;
          avatarUrl: string;
          playerId: number;
        } | null,
        isLoading: false,
        isAuthenticated: true,
        fetchUser: vi.fn(),
        logout: vi.fn(),
      };
      return selector ? selector(state) : state;
    });
    vi.mocked(useActivityDataModule.useActivityData).mockReturnValue(
      mockActivityData,
    );
  });

  it("로딩 중일 때 로딩 컴포넌트를 표시한다", () => {
    vi.mocked(useActivityDataModule.useActivityData).mockReturnValue({
      ...mockActivityData,
      isLoading: true,
    });

    render(<ActivityTab />);

    expect(screen.getByText("프로필 로딩 중...")).toBeInTheDocument();
  });

  it("로딩 완료 시 CalendarHeatmap이 렌더링된다", () => {
    render(<ActivityTab />);

    expect(screen.getByTestId("calendar-heatmap")).toBeInTheDocument();
  });

  it("로딩 완료 시 StatsSection이 렌더링된다", () => {
    render(<ActivityTab />);

    expect(screen.getByTestId("stats-section")).toBeInTheDocument();
  });

  it("로딩 완료 시 DetailSection이 렌더링된다", () => {
    render(<ActivityTab />);

    expect(screen.getByTestId("detail-section")).toBeInTheDocument();
  });

  it("로딩 중일 때 CalendarHeatmap, StatsSection, DetailSection이 렌더링되지 않는다", () => {
    vi.mocked(useActivityDataModule.useActivityData).mockReturnValue({
      ...mockActivityData,
      isLoading: true,
    });

    render(<ActivityTab />);

    expect(screen.queryByTestId("calendar-heatmap")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stats-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("detail-section")).not.toBeInTheDocument();
  });

  it("targetPlayerId가 없으면 현재 유저의 playerId를 사용한다", () => {
    vi.mocked(useModalStore).mockImplementation((selector) => {
      const state = {
        activeModal: "userInfo" as const,
        userInfoPayload: null,
        openModal: vi.fn(),
        closeModal: vi.fn(),
        toggleModal: vi.fn(),
      };
      return selector(state);
    });

    render(<ActivityTab />);

    expect(useActivityDataModule.useActivityData).toHaveBeenCalledWith(
      1,
      expect.any(Date),
    );
  });
});
