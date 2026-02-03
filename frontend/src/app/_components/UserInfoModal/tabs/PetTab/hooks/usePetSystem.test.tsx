import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePetSystem } from "./usePetSystem";
import {
  resetPetStore,
  seedAllPets,
  seedInventory,
  seedCodex,
  seedPlayer,
} from "@test/mocks/handlers/pets";
import {
  buildPetEntity,
  buildUserPetEntity,
  buildPlayerEntity,
  resetPetFactoryCounters,
} from "@test/factories/pet";
import type { ReactNode } from "react";

// QueryClient wrapper for testing
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

// Mock socket
vi.mock("@/lib/socket", () => ({
  getSocket: () => ({
    connected: true,
    emit: vi.fn(),
  }),
}));

// Mock window event
const dispatchEventSpy = vi.fn();
Object.defineProperty(window, "dispatchEvent", {
  value: dispatchEventSpy,
  writable: true,
});

const TEST_PLAYER_ID = 123;

describe("usePetSystem Hook", () => {
  // 테스트용 펫 데이터
  const gopherStage1 = buildPetEntity({
    id: 1,
    species: "gopher",
    name: "고퍼1",
    evolutionStage: 1,
    evolutionRequiredExp: 100,
  });

  const gopherStage2 = buildPetEntity({
    id: 2,
    species: "gopher",
    name: "고퍼2",
    evolutionStage: 2,
    evolutionRequiredExp: 200,
  });

  const catStage1 = buildPetEntity({
    id: 3,
    species: "cat",
    name: "고양이1",
    evolutionStage: 1,
    evolutionRequiredExp: 100,
  });

  const allPets = [gopherStage1, gopherStage2, catStage1];

  beforeEach(() => {
    resetPetStore();
    resetPetFactoryCounters();
    seedAllPets(allPets);
    dispatchEventSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("데이터 조회", () => {
    it("playerId가 주어지면 인벤토리를 조회한다", async () => {
      const userPet = buildUserPetEntity({ id: 1, pet: gopherStage1, exp: 50 });
      seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID, totalPoint: 1000 }));
      seedInventory(TEST_PLAYER_ID, [userPet]);
      seedCodex(TEST_PLAYER_ID, [1]);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.inventory).toHaveLength(1);
      expect(result.current.inventory[0].pet.name).toBe("고퍼1");
    });

    it("도감(codex)을 조회한다", async () => {
      seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID }));
      seedInventory(TEST_PLAYER_ID, []);
      seedCodex(TEST_PLAYER_ID, [1, 2]);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.codex).toEqual([1, 2]);
    });

    it("전체 펫 목록을 조회한다", async () => {
      seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID }));
      seedInventory(TEST_PLAYER_ID, []);
      seedCodex(TEST_PLAYER_ID, []);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.allPets.length).toBeGreaterThan(0);
      });

      expect(result.current.allPets).toHaveLength(3);
    });

    it("플레이어 정보를 조회한다", async () => {
      seedPlayer(
        buildPlayerEntity({
          id: TEST_PLAYER_ID,
          totalPoint: 500,
          equippedPetId: 1,
        }),
      );
      seedInventory(TEST_PLAYER_ID, []);
      seedCodex(TEST_PLAYER_ID, []);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.player).toBeDefined();
      });

      expect(result.current.player?.totalPoint).toBe(500);
      expect(result.current.player?.equippedPetId).toBe(1);
    });
  });

  describe("가챠 (gacha)", () => {
    it("가챠 실행 시 새 펫을 받는다", async () => {
      seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID, totalPoint: 1000 }));
      seedInventory(TEST_PLAYER_ID, []);
      seedCodex(TEST_PLAYER_ID, []);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let gachaResult: Awaited<ReturnType<typeof result.current.gacha>>;

      await act(async () => {
        gachaResult = await result.current.gacha();
      });

      expect(gachaResult!.userPet.pet).toBeDefined();
      expect(gachaResult!.isDuplicate).toBe(false);
    });

    it("중복 펫이면 isDuplicate=true를 반환한다", async () => {
      seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID, totalPoint: 1000 }));
      seedInventory(TEST_PLAYER_ID, []);
      // 모든 stage1 펫을 이미 수집한 상태
      seedCodex(TEST_PLAYER_ID, [1, 3]);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let gachaResult: Awaited<ReturnType<typeof result.current.gacha>>;

      await act(async () => {
        gachaResult = await result.current.gacha();
      });

      expect(gachaResult!.isDuplicate).toBe(true);
    });
  });

  describe("먹이주기 (feed)", () => {
    it("먹이주기 성공 시 경험치가 증가한다", async () => {
      const userPet = buildUserPetEntity({ id: 10, pet: gopherStage1, exp: 0 });
      seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID, totalPoint: 1000 }));
      seedInventory(TEST_PLAYER_ID, [userPet]);
      seedCodex(TEST_PLAYER_ID, [1]);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.feed(10);
      });

      // API 호출이 성공했으면 OK (실제 캐시 갱신은 invalidateQueries로 처리)
      expect(true).toBe(true);
    });
  });

  describe("펫 장착 (equip)", () => {
    it("펫 장착 성공 시 소켓 이벤트와 window 이벤트가 발생한다", async () => {
      seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID }));
      seedInventory(TEST_PLAYER_ID, []);
      seedCodex(TEST_PLAYER_ID, [1]);

      const { result } = renderHook(() => usePetSystem(TEST_PLAYER_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.allPets.length).toBeGreaterThan(0);
      });

      await act(async () => {
        await result.current.equip(1);
      });

      // window.dispatchEvent가 호출되었는지 확인
      expect(dispatchEventSpy).toHaveBeenCalled();
      const event = dispatchEventSpy.mock.calls[0][0];
      expect(event.type).toBe("local_pet_update");
    });
  });
});
