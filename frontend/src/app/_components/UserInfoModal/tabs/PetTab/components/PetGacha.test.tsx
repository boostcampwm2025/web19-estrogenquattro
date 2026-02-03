import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PetGacha from "./PetGacha";
import { buildPetEntity } from "@test/factories/pet";

describe("PetGacha 컴포넌트", () => {
  const mockPet = buildPetEntity({
    id: 1,
    name: "테스트고퍼",
    evolutionStage: 1,
  });

  const defaultProps = {
    onPetCollected: vi.fn(),
    onGacha: vi.fn().mockResolvedValue({ pet: mockPet, isDuplicate: false }),
    onGachaRefund: vi
      .fn()
      .mockResolvedValue({ refundAmount: 50, totalPoint: 950 }),
    points: 1000,
    hasCollectedAllStage1: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("기본 렌더링 (idle 상태)", () => {
    it("알 이미지와 뽑기 버튼이 보인다", () => {
      render(<PetGacha {...defaultProps} />);

      // 제목과 버튼 모두 "펫 뽑기" 텍스트가 있음
      expect(
        screen.getByRole("heading", { name: "펫 뽑기" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "펫 뽑기" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/어떤 펫이 나올까요/)).toBeInTheDocument();
      expect(screen.getByText(/1회: 100 P/)).toBeInTheDocument();
    });

    it("펫 뽑기 버튼이 활성화되어 있다", () => {
      render(<PetGacha {...defaultProps} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      expect(button).not.toBeDisabled();
    });
  });

  describe("포인트 부족 시", () => {
    it("포인트가 100 미만이면 뽑기 버튼이 비활성화된다", () => {
      render(<PetGacha {...defaultProps} points={50} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      expect(button).toBeDisabled();
    });
  });

  describe("모든 Stage1 펫 수집 완료 시", () => {
    it("hasCollectedAllStage1=true면 버튼이 비활성화된다", () => {
      render(<PetGacha {...defaultProps} hasCollectedAllStage1={true} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      expect(button).toBeDisabled();
    });

    it("수집 완료 안내 메시지가 표시된다", () => {
      render(<PetGacha {...defaultProps} hasCollectedAllStage1={true} />);

      expect(
        screen.getByText(/더 이상 뽑을 새로운 펫이 없습니다/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/기존 펫을 성장시켜 진화해 보세요/),
      ).toBeInTheDocument();
    });

    it("알 이미지가 흐리게(grayscale) 표시된다", () => {
      render(<PetGacha {...defaultProps} hasCollectedAllStage1={true} />);

      const eggElement = document.querySelector(".gacha-egg");
      expect(eggElement).toHaveClass("opacity-50", "grayscale");
    });
  });

  describe("뽑기 애니메이션", () => {
    it("버튼 클릭 시 animating 상태로 전환된다", async () => {
      const user = userEvent.setup();
      render(<PetGacha {...defaultProps} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      await user.click(button);

      expect(screen.getByText("알이 깨지고 있어요!")).toBeInTheDocument();
    });
  });

  describe("뽑기 결과 - 새 펫 획득", () => {
    it("새 펫 획득 시 축하 메시지와 펫 이미지가 표시된다", async () => {
      const user = userEvent.setup();
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<PetGacha {...defaultProps} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      await user.click(button);

      // 5초 애니메이션 대기
      await vi.advanceTimersByTimeAsync(5000);

      await waitFor(() => {
        expect(screen.getByText("축하합니다!")).toBeInTheDocument();
        expect(screen.getByText(/테스트고퍼/)).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("새 펫 획득 시 onPetCollected가 호출된다", async () => {
      const user = userEvent.setup();
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<PetGacha {...defaultProps} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      await user.click(button);

      await vi.advanceTimersByTimeAsync(5000);

      await waitFor(() => {
        expect(defaultProps.onPetCollected).toHaveBeenCalledWith(mockPet.id);
      });

      vi.useRealTimers();
    });
  });

  describe("뽑기 결과 - 중복 펫", () => {
    it("중복 펫 시 환급 안내 메시지가 표시된다", async () => {
      const user = userEvent.setup();
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const duplicateProps = {
        ...defaultProps,
        onGacha: vi.fn().mockResolvedValue({ pet: mockPet, isDuplicate: true }),
      };

      render(<PetGacha {...duplicateProps} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      await user.click(button);

      await vi.advanceTimersByTimeAsync(5000);

      await waitFor(() => {
        expect(
          screen.getByText(/이미 함께하고 있는 친구네요/),
        ).toBeInTheDocument();
        expect(screen.getByText(/50P가 환급/)).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it("중복 펫 시 onGachaRefund가 호출된다", async () => {
      const user = userEvent.setup();
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const duplicateProps = {
        ...defaultProps,
        onGacha: vi.fn().mockResolvedValue({ pet: mockPet, isDuplicate: true }),
      };

      render(<PetGacha {...duplicateProps} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      await user.click(button);

      await vi.advanceTimersByTimeAsync(5000);

      await waitFor(() => {
        expect(duplicateProps.onGachaRefund).toHaveBeenCalled();
      });

      vi.useRealTimers();
    });

    it("중복 펫 시 onPetCollected가 호출되지 않는다", async () => {
      const user = userEvent.setup();
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const duplicateProps = {
        ...defaultProps,
        onGacha: vi.fn().mockResolvedValue({ pet: mockPet, isDuplicate: true }),
      };

      render(<PetGacha {...duplicateProps} />);

      const button = screen.getByRole("button", { name: "펫 뽑기" });
      await user.click(button);

      await vi.advanceTimersByTimeAsync(5000);

      await waitFor(() => {
        expect(
          screen.getByText(/이미 함께하고 있는 친구네요/),
        ).toBeInTheDocument();
      });

      expect(duplicateProps.onPetCollected).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("확인 버튼", () => {
    it("결과 화면에서 확인 버튼 클릭 시 idle 상태로 돌아간다", async () => {
      const user = userEvent.setup();
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<PetGacha {...defaultProps} />);

      // 뽑기 실행
      const gachaButton = screen.getByRole("button", { name: "펫 뽑기" });
      await user.click(gachaButton);

      await vi.advanceTimersByTimeAsync(5000);

      // 확인 버튼 클릭
      const confirmButton = await screen.findByRole("button", { name: "확인" });
      await user.click(confirmButton);

      // idle 상태 확인
      await waitFor(() => {
        expect(screen.getByText(/어떤 펫이 나올까요/)).toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });
});
