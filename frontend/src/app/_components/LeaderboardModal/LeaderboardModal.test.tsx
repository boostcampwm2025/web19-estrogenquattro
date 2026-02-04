import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeaderboardModal from "./LeaderboardModal";
import * as useModalStoreModule from "@/stores/useModalStore";
import { MODAL_TYPES } from "@/stores/useModalStore";
import * as authStoreModule from "@/stores/authStore";
import * as hooksModule from "@/lib/api/hooks";
import { POINT_TYPES } from "@/lib/api";
import type { TotalRankRes, ActivityRankRes } from "@/lib/api/point";

vi.mock("@/stores/useModalStore");
vi.mock("@/stores/authStore");
vi.mock("@/lib/api/hooks");
vi.mock("@/hooks/useModalClose", () => ({
  useModalClose: ({ onClose }: { onClose: () => void }) => ({
    contentRef: { current: null },
    handleClose: onClose,
    handleBackdropClick: (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
  }),
}));

const mockCloseModal = vi.fn();

const mockModalStore = {
  activeModal: MODAL_TYPES.LEADERBOARD as useModalStoreModule.ModalType,
  closeModal: mockCloseModal,
};

const mockUser = {
  sub: "123",
  username: "testuser",
  avatarUrl: "https://example.com/avatar.png",
  playerId: 1,
};

const mockTotalRanks: TotalRankRes[] = [
  { playerId: 1, rank: 1, nickname: "player1", totalPoints: 100 },
  { playerId: 2, rank: 2, nickname: "player2", totalPoints: 80 },
  { playerId: 3, rank: 3, nickname: "player3", totalPoints: 60 },
];

const mockActivityRanks: ActivityRankRes[] = [
  { playerId: 1, rank: 1, nickname: "player1", count: 3600 },
  { playerId: 2, rank: 2, nickname: "player2", count: 1800 },
];

describe("LeaderboardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useModalStoreModule.useModalStore).mockImplementation(
      (selector) => selector(mockModalStore as never),
    );

    vi.mocked(authStoreModule.useAuthStore).mockImplementation((selector) =>
      selector({ user: mockUser } as never),
    );

    vi.mocked(hooksModule.useLeaderboard).mockReturnValue({
      ranks: mockTotalRanks,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isAllType: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("렌더링", () => {
    it("모달이 열리면 리더보드가 표시된다", async () => {
      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
      expect(screen.getByText("주간 순위표")).toBeInTheDocument();
    });

    it("모달이 닫혀있으면 아무것도 렌더링하지 않는다", () => {
      vi.mocked(useModalStoreModule.useModalStore).mockImplementation(
        (selector) =>
          selector({ ...mockModalStore, activeModal: null } as never),
      );

      const { container } = render(<LeaderboardModal />);

      expect(container.firstChild).toBeNull();
    });

    it("플레이어 순위 영역이 렌더링된다", async () => {
      render(<LeaderboardModal />);

      // 순위 목록 영역 렌더링 확인
      await waitFor(() => {
        expect(screen.getByText("순위")).toBeInTheDocument();
      });
      expect(screen.getByText("프로필")).toBeInTheDocument();
      expect(screen.getByText("깃허브 네임")).toBeInTheDocument();
      // 포인트는 탭 버튼과 헤더에 두 번 나타남
      expect(screen.getAllByText("포인트")).toHaveLength(2);
    });

    it("플레이어 데이터가 비어있으면 빈 상태 메시지를 표시한다", async () => {
      vi.mocked(hooksModule.useLeaderboard).mockReturnValue({
        ranks: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isAllType: true,
      });

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(
          screen.getByText("아직 이번 주 랭킹 데이터가 없습니다."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("무한 로딩 방지", () => {
    it("isLoading이 true일 때 캐시된 데이터가 없으면 모달을 렌더링하지 않는다", async () => {
      vi.mocked(hooksModule.useLeaderboard).mockReturnValue({
        ranks: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        isAllType: true,
      });

      const { container } = render(<LeaderboardModal />);

      // isLoading이 true이고 cachedData가 없으면 렌더링 안 됨
      await waitFor(
        () => {
          expect(container.firstChild).toBeNull();
        },
        { timeout: 100 },
      );
    });

    it("데이터 로딩 완료 후 정상적으로 렌더링된다", async () => {
      vi.mocked(hooksModule.useLeaderboard).mockReturnValue({
        ranks: mockTotalRanks,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isAllType: true,
      });

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("탭 전환 시 모달이 정상적으로 유지된다", async () => {
      const user = userEvent.setup();

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // 탭 전환 클릭
      const focusedTab = screen.getByText("집중 시간");
      await user.click(focusedTab);

      // 모달이 여전히 렌더링됨
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      // 탭이 활성화됨
      expect(focusedTab.className).toContain("bg-amber-700");
    });
  });

  describe("탭 전환", () => {
    it("집중 시간 탭을 클릭하면 해당 탭으로 전환된다", async () => {
      const user = userEvent.setup();

      vi.mocked(hooksModule.useLeaderboard).mockReturnValue({
        ranks: mockTotalRanks,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isAllType: true,
      });

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const focusedTab = screen.getByText("집중 시간");
      await user.click(focusedTab);

      // 탭 버튼의 활성 스타일 확인
      expect(focusedTab.className).toContain("bg-amber-700");
    });

    it("Enter 키로도 탭을 전환할 수 있다", async () => {
      const user = userEvent.setup();

      vi.mocked(hooksModule.useLeaderboard).mockReturnValue({
        ranks: mockTotalRanks,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isAllType: true,
      });

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const focusedTab = screen.getByText("집중 시간");
      focusedTab.focus();
      await user.keyboard("{Enter}");

      expect(focusedTab.className).toContain("bg-amber-700");
    });

    it("집중 시간 탭에서는 시간 열 헤더가 표시된다", async () => {
      const user = userEvent.setup();

      vi.mocked(hooksModule.useLeaderboard)
        .mockReturnValueOnce({
          ranks: mockTotalRanks,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
          isAllType: true,
        })
        .mockReturnValue({
          ranks: mockActivityRanks,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
          isAllType: false,
        });

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const focusedTab = screen.getByText("집중 시간");
      await user.click(focusedTab);

      await waitFor(() => {
        expect(screen.getByText("시간")).toBeInTheDocument();
      });
    });
  });

  describe("닫기 동작", () => {
    it("닫기 버튼 클릭 시 모달이 닫힌다", async () => {
      const user = userEvent.setup();

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("리더보드 모달 닫기");
      await user.click(closeButton);

      expect(mockCloseModal).toHaveBeenCalled();
    });

    it("백드롭 클릭 시 모달이 닫힌다", async () => {
      const user = userEvent.setup();

      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // 백드롭 요소 클릭 (다이얼로그 외부)
      const backdrop = screen.getByRole("dialog").parentElement;
      if (backdrop) {
        await user.click(backdrop);
        expect(mockCloseModal).toHaveBeenCalled();
      }
    });
  });

  describe("시즌 타이머", () => {
    it("시즌 타이머가 표시된다", async () => {
      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByText("현재 시즌 타이머")).toBeInTheDocument();
      });
    });

    it("시즌 타이머 UI 요소가 올바르게 렌더링된다", async () => {
      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByText("현재 시즌 타이머")).toBeInTheDocument();
      });

      // 타이머 형식이 올바르게 표시되는지 확인
      expect(screen.getByText(/day :/)).toBeInTheDocument();
    });
  });

  describe("접근성", () => {
    it("dialog role과 aria 속성이 올바르게 설정된다", async () => {
      render(<LeaderboardModal />);

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby", "leaderboard-title");
      });
    });

    it("닫기 버튼에 적절한 aria-label이 있다", async () => {
      render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByLabelText("리더보드 모달 닫기")).toBeInTheDocument();
      });
    });
  });

  describe("모달 닫힘 시 상태 초기화", () => {
    it("모달이 닫히면 캐시된 데이터가 초기화된다", async () => {
      const { rerender } = render(<LeaderboardModal />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // 모달 닫기
      vi.mocked(useModalStoreModule.useModalStore).mockImplementation(
        (selector) =>
          selector({ ...mockModalStore, activeModal: null } as never),
      );

      rerender(<LeaderboardModal />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // 다시 열기
      vi.mocked(useModalStoreModule.useModalStore).mockImplementation(
        (selector) => selector(mockModalStore as never),
      );

      // 로딩 상태로 시작
      vi.mocked(hooksModule.useLeaderboard).mockReturnValue({
        ranks: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        isAllType: true,
      });

      rerender(<LeaderboardModal />);

      // 초기화되어 캐시가 없으므로 렌더링 안 됨
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
