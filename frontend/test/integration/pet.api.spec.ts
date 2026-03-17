import { beforeEach, describe, expect, it } from "vitest";

import { petApi } from "@/lib/api/pet";
import {
  resetPetStore,
  seedAllPets,
  seedCodex,
  seedInventory,
  seedPlayer,
} from "@test/mocks/handlers/pets";
import {
  buildPetEntity,
  buildPlayerEntity,
  buildUserPetEntity,
  resetPetFactoryCounters,
} from "@test/factories/pet";

const TEST_PLAYER_ID = 777;

describe("Pet API 통합", () => {
  beforeEach(() => {
    resetPetStore();
    resetPetFactoryCounters();

    const stage1 = buildPetEntity({
      id: 1,
      species: "gopher",
      name: "고퍼1",
      evolutionStage: 1,
      evolutionRequiredExp: 20,
    });
    const stage2 = buildPetEntity({
      id: 2,
      species: "gopher",
      name: "고퍼2",
      evolutionStage: 2,
      evolutionRequiredExp: 0,
    });

    seedAllPets([stage1, stage2]);
    seedPlayer(buildPlayerEntity({ id: TEST_PLAYER_ID, totalPoint: 500 }));
    seedInventory(TEST_PLAYER_ID, [
      buildUserPetEntity({ id: 10, pet: stage1, exp: 20 }),
    ]);
    seedCodex(TEST_PLAYER_ID, [1]);
  });

  it("인벤토리와 플레이어 정보를 조회한다", async () => {
    const inventory = await petApi.getInventory(TEST_PLAYER_ID);
    const player = await petApi.getPlayer(TEST_PLAYER_ID);

    expect(inventory).toHaveLength(1);
    expect(player.totalPoint).toBe(500);
  });

  it("가챠 환급과 장착 API를 호출한다", async () => {
    const gacha = await petApi.gacha();
    const refund = await petApi.gachaRefund();
    const equip = await petApi.equipPet(gacha.userPet.pet.id);

    expect(gacha.userPet.pet).toBeDefined();
    expect(refund.refundAmount).toBeGreaterThan(0);
    expect(equip.success).toBe(true);
  });

  it("먹이주기 후 진화를 호출할 수 있다", async () => {
    const fed = await petApi.feed(10);
    const evolved = await petApi.evolve(10);

    expect(fed.exp).toBeGreaterThanOrEqual(10);
    expect(evolved.pet.evolutionStage).toBe(2);
  });
});
