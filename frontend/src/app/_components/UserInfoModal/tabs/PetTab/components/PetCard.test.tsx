import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PetCard from "./PetCard";

describe("PetCard 컴포넌트", () => {
  const defaultStageData = {
    stage: 1,
    name: "테스트고퍼",
    description: "귀여운 고퍼입니다",
    image: "/assets/mascot/gopher_stage1.webp",
    maxExp: 100,
  };

  const defaultProps = {
    exp: 50,
    maxExp: 100,
    currentStageData: defaultStageData,
    onAction: vi.fn(),
    isOwner: true,
    points: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("기본 렌더링", () => {
    it("펫 이름이 표시된다", () => {
      render(<PetCard {...defaultProps} />);

      expect(screen.getByText("테스트고퍼")).toBeInTheDocument();
    });

    it("펫 설명이 표시된다", () => {
      render(<PetCard {...defaultProps} />);

      expect(screen.getByText("귀여운 고퍼입니다")).toBeInTheDocument();
    });

    it("경험치 바가 표시된다", () => {
      render(<PetCard {...defaultProps} />);

      expect(screen.getByText("EXP")).toBeInTheDocument();
      expect(screen.getByText("50 / 100")).toBeInTheDocument();
    });
  });

  describe("만렙 펫 (maxExp === 0)", () => {
    it("경험치가 MAX로 표시된다", () => {
      render(<PetCard {...defaultProps} maxExp={0} />);

      expect(screen.getByText("MAX")).toBeInTheDocument();
    });

    it("밥주기/진화 버튼이 비활성화된다", () => {
      render(<PetCard {...defaultProps} maxExp={0} />);

      // 만렙이면 버튼이 disabled
      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe("밥주기 버튼", () => {
    it("owner이고 포인트 충분하면 밥주기 버튼이 활성화된다", () => {
      render(<PetCard {...defaultProps} />);

      const button = screen.getByRole("button", { name: /밥주기/i });
      expect(button).not.toBeDisabled();
    });

    it("포인트가 10 미만이면 밥주기 버튼이 비활성화된다", () => {
      render(<PetCard {...defaultProps} points={5} />);

      const button = screen.getByRole("button", { name: /밥주기/i });
      expect(button).toBeDisabled();
    });

    it("밥주기 클릭 시 onAction이 호출된다", async () => {
      const user = userEvent.setup();
      render(<PetCard {...defaultProps} />);

      const button = screen.getByRole("button", { name: /밥주기/i });
      await user.click(button);

      expect(defaultProps.onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe("진화 가능 상태 (exp >= maxExp)", () => {
    it("진화 버튼이 표시된다", () => {
      render(<PetCard {...defaultProps} exp={100} maxExp={100} />);

      expect(screen.getByRole("button", { name: /진화/i })).toBeInTheDocument();
    });

    it("진화 가능 메시지가 표시된다", () => {
      render(<PetCard {...defaultProps} exp={100} maxExp={100} />);

      expect(screen.getByText(/진화가 가능합니다/)).toBeInTheDocument();
    });

    it("진화 버튼 클릭 시 onAction이 호출된다", async () => {
      const user = userEvent.setup();
      render(<PetCard {...defaultProps} exp={100} maxExp={100} />);

      const button = screen.getByRole("button", { name: /진화/i });
      await user.click(button);

      expect(defaultProps.onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe("비owner 모드", () => {
    it("isOwner=false면 액션 버튼이 보이지 않는다", () => {
      render(<PetCard {...defaultProps} isOwner={false} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("펫 정보는 여전히 표시된다", () => {
      render(<PetCard {...defaultProps} isOwner={false} />);

      expect(screen.getByText("테스트고퍼")).toBeInTheDocument();
      expect(screen.getByText("EXP")).toBeInTheDocument();
    });
  });
});
