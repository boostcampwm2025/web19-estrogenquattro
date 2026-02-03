import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PetTab from "./PetTab";
import { useModalStore } from "@/stores/useModalStore";
import { useAuthStore } from "@/stores/authStore";
import { usePetSystem } from "./hooks/usePetSystem";
import { buildPetEntity } from "@test/factories/pet";

// Mock hooks
vi.mock("@/stores/useModalStore");
vi.mock("@/stores/authStore");
vi.mock("./hooks/usePetSystem");

// Mock child components to verify props only
vi.mock("./components/PetGacha", () => ({
  default: ({ hasCollectedAllStage1 }: { hasCollectedAllStage1: boolean }) => (
    <div data-testid="pet-gacha">
      PetGacha (All collected: {hasCollectedAllStage1.toString()})
    </div>
  ),
}));
vi.mock("./components/PetCard", () => ({
  default: () => <div data-testid="pet-card">PetCard</div>,
}));
vi.mock("./components/PetCodex", () => ({
  default: () => <div data-testid="pet-codex">PetCodex</div>,
}));
vi.mock("./components/LicenseInfo", () => ({
  LicenseInfo: () => <div data-testid="license-info">LicenseInfo</div>,
}));

describe("PetTab 컴포넌트", () => {
  const mockPet = buildPetEntity({
    id: 1,
    species: "gopher",
    name: "고퍼1",
    evolutionStage: 1,
  });

  const mockUsePetSystem = {
    inventory: [],
    codex: [],
    player: { totalPoint: 1000, equippedPetId: null },
    allPets: [mockPet],
    isLoading: false,
    gacha: vi.fn(),
    gachaRefund: vi.fn(),
    feed: vi.fn(),
    evolve: vi.fn(),
    equip: vi.fn(),
    refreshPets: vi.fn(),
  } as unknown as ReturnType<typeof usePetSystem>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { playerId: 123 },
    });

    (useModalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(123); // targetPlayerId

    (usePetSystem as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockUsePetSystem,
    );
  });

  it("로딩 중일 때 Loading 메시지를 표시한다", () => {
    (usePetSystem as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockUsePetSystem,
      isLoading: true,
      allPets: [],
    });

    render(<PetTab />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("자식 컴포넌트들이 정상적으로 렌더링된다", () => {
    render(<PetTab />);

    expect(screen.getByTestId("license-info")).toBeInTheDocument();
    expect(screen.getByTestId("pet-codex")).toBeInTheDocument();
    // 초기 상태에서 inventory가 비어있으면 PetCard는 렌더링되지 않음 (보유 펫 없음 메시지)
    expect(screen.queryByTestId("pet-card")).not.toBeInTheDocument();
    expect(screen.getByText("보유한 펫이 없습니다")).toBeInTheDocument();
  });

  it("보유 펫이 있으면 PetCard가 렌더링된다", () => {
    (usePetSystem as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockUsePetSystem,
      inventory: [{ id: 1, pet: mockPet, exp: 0 }],
      player: { totalPoint: 1000, equippedPetId: 1 },
    });

    render(<PetTab />);

    expect(screen.getByTestId("pet-card")).toBeInTheDocument();
  });

  it("Owner인 경우 PetGacha가 렌더링된다", () => {
    render(<PetTab />); // ownerId === targetId (123 === 123)

    expect(screen.getByTestId("pet-gacha")).toBeInTheDocument();
  });

  it("Owner가 아닌 경우 PetGacha가 렌더링되지 않는다", () => {
    (useModalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(999); // targetPlayerId != user.playerId

    render(<PetTab />);

    expect(screen.queryByTestId("pet-gacha")).not.toBeInTheDocument();
  });

  it("모든 stage1 펫을 수집하면 hasCollectedAllStage1 prop이 true로 전달된다", () => {
    const stage1Pet = buildPetEntity({ id: 1, evolutionStage: 1 });
    const stage2Pet = buildPetEntity({ id: 2, evolutionStage: 2 });

    (usePetSystem as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockUsePetSystem,
      allPets: [stage1Pet, stage2Pet],
      codex: [1], // stage1 펫 수집 완료
    });

    render(<PetTab />);

    expect(
      screen.getByText("PetGacha (All collected: true)"),
    ).toBeInTheDocument();
  });

  it("stage1 펫을 모두 수집하지 못하면 hasCollectedAllStage1 prop이 false로 전달된다", () => {
    const stage1Pet1 = buildPetEntity({ id: 1, evolutionStage: 1 });
    const stage1Pet2 = buildPetEntity({ id: 2, evolutionStage: 1 });

    (usePetSystem as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockUsePetSystem,
      allPets: [stage1Pet1, stage1Pet2],
      codex: [1], // 하나만 수집
    });

    render(<PetTab />);

    expect(
      screen.getByText("PetGacha (All collected: false)"),
    ).toBeInTheDocument();
  });
});
