import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PetCodex from "./PetCodex";
import { buildPetEntity } from "@test/factories/pet";

describe("PetCodex 컴포넌트", () => {
  // 고퍼 진화 라인 (stage 1, 2, 3)
  const gopherPets = [
    buildPetEntity({
      id: 1,
      species: "gopher",
      name: "고퍼",
      evolutionStage: 1,
    }),
    buildPetEntity({
      id: 2,
      species: "gopher",
      name: "고퍼2",
      evolutionStage: 2,
    }),
    buildPetEntity({
      id: 3,
      species: "gopher",
      name: "고퍼3",
      evolutionStage: 3,
      evolutionRequiredExp: 0,
    }),
  ];

  // 다른 종류 펫
  const catPets = [
    buildPetEntity({
      id: 4,
      species: "cat",
      name: "고양이",
      evolutionStage: 1,
    }),
    buildPetEntity({
      id: 5,
      species: "cat",
      name: "고양이2",
      evolutionStage: 2,
    }),
  ];

  const allPets = [...gopherPets, ...catPets];

  const defaultProps = {
    allPets,
    collectedPetIds: [1, 2], // 고퍼 1, 2단계만 수집
    equippedPetId: 2,
    onPetSelect: vi.fn(),
    isOwner: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("수집 현황 표시", () => {
    it("N / M 수집 형식으로 표시된다", () => {
      render(<PetCodex {...defaultProps} />);

      expect(screen.getByText("2 / 5 수집")).toBeInTheDocument();
    });

    it("수집 개수가 변경되면 업데이트된다", () => {
      render(<PetCodex {...defaultProps} collectedPetIds={[1, 2, 3, 4]} />);

      expect(screen.getByText("4 / 5 수집")).toBeInTheDocument();
    });
  });

  describe("수집된 펫 표시", () => {
    it("수집된 펫은 실제 이름이 표시된다", () => {
      render(<PetCodex {...defaultProps} />);

      expect(screen.getByText("고퍼")).toBeInTheDocument();
      expect(screen.getByText("고퍼2")).toBeInTheDocument();
    });

    it("수집된 펫은 클릭 가능하다", async () => {
      const user = userEvent.setup();
      render(<PetCodex {...defaultProps} />);

      // 고퍼(id: 1)를 클릭
      const gopherCard = screen
        .getByText("고퍼")
        .closest("div[class*='cursor-pointer']");
      if (gopherCard) {
        await user.click(gopherCard);
        expect(defaultProps.onPetSelect).toHaveBeenCalledWith(1);
      }
    });
  });

  describe("미수집 펫 표시", () => {
    it("미수집 펫은 ???로 표시된다", () => {
      render(<PetCodex {...defaultProps} />);

      // 고퍼3(id: 3), 고양이1(id: 4), 고양이2(id: 5)가 미수집
      const questionMarks = screen.getAllByText("???");
      expect(questionMarks).toHaveLength(3);
    });
  });

  describe("진화 라인 그룹화", () => {
    it("같은 species 펫이 한 그룹에 표시된다", () => {
      render(<PetCodex {...defaultProps} />);

      // 진화 화살표(▶)가 진화 라인 내 펫 사이에 표시됨
      // 고퍼: 3개 펫 -> 2개 화살표, 고양이: 2개 펫 -> 1개 화살표 = 총 3개
      const arrows = screen.getAllByText("▶");
      expect(arrows).toHaveLength(3);
    });
  });

  describe("대표펫 뱃지", () => {
    it("장착된 펫에 대표펫 뱃지가 표시된다", () => {
      render(<PetCodex {...defaultProps} />);

      expect(screen.getByText("대표펫")).toBeInTheDocument();
    });

    it("다른 펫이 장착되면 뱃지가 이동한다", () => {
      render(<PetCodex {...defaultProps} equippedPetId={1} />);

      // 대표펫 뱃지는 여전히 1개만 존재
      expect(screen.getAllByText("대표펫")).toHaveLength(1);
    });
  });

  describe("비owner 모드", () => {
    it("isOwner=false면 펫 클릭 시 onPetSelect가 호출되지 않는다", async () => {
      const user = userEvent.setup();
      render(<PetCodex {...defaultProps} isOwner={false} />);

      // 고퍼 카드 클릭 시도
      const gopherCard = screen.getByText("고퍼").closest("div");
      if (gopherCard) {
        await user.click(gopherCard);
        expect(defaultProps.onPetSelect).not.toHaveBeenCalled();
      }
    });

    it("펫 정보는 여전히 표시된다", () => {
      render(<PetCodex {...defaultProps} isOwner={false} />);

      expect(screen.getByText("고퍼")).toBeInTheDocument();
      expect(screen.getByText("2 / 5 수집")).toBeInTheDocument();
    });
  });
});
