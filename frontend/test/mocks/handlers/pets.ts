import { http, HttpResponse } from "msw";
import type { PetEntity, UserPetEntity, PlayerEntity } from "../../shared/pet";
import { toPetRes, toUserPetRes, toPlayerRes } from "../../shared/pet";

// In-memory stores for test state
let petStore: PetEntity[] = [];
let userPetStore: Map<number, UserPetEntity[]> = new Map(); // playerId -> UserPet[]
let codexStore: Map<number, number[]> = new Map(); // playerId -> collectedPetIds[]
let playerStore: Map<number, PlayerEntity> = new Map(); // playerId -> Player
let nextUserPetId = 1;

// Store management functions
export const resetPetStore = () => {
  petStore = [];
  userPetStore.clear();
  codexStore.clear();
  playerStore.clear();
  nextUserPetId = 1;
};

export const seedAllPets = (pets: PetEntity[]) => {
  petStore = [...pets];
};

export const seedInventory = (playerId: number, userPets: UserPetEntity[]) => {
  userPetStore.set(playerId, [...userPets]);
  const maxId = userPets.reduce(
    (max, up) => Math.max(max, up.id),
    nextUserPetId,
  );
  nextUserPetId = maxId + 1;
};

export const seedCodex = (playerId: number, petIds: number[]) => {
  codexStore.set(playerId, [...petIds]);
};

export const seedPlayer = (player: PlayerEntity) => {
  playerStore.set(player.id, { ...player });
};

const GACHA_COST = 100;
const FEED_COST = 10;
const FEED_EXP = 10;

export const petHandlers = [
  // GET /api/pets/all - 전체 펫 목록
  http.get("*/api/pets/all", () => {
    return HttpResponse.json(petStore.map(toPetRes));
  }),

  // GET /api/pets/inventory/:playerId - 인벤토리 조회
  http.get("*/api/pets/inventory/:playerId", ({ params }) => {
    const playerId = Number(params.playerId);
    const inventory = userPetStore.get(playerId) ?? [];
    return HttpResponse.json(inventory.map(toUserPetRes));
  }),

  // GET /api/pets/codex/:playerId - 도감 조회
  http.get("*/api/pets/codex/:playerId", ({ params }) => {
    const playerId = Number(params.playerId);
    const codex = codexStore.get(playerId) ?? [];
    return HttpResponse.json(codex);
  }),

  // GET /api/players/:playerId/info - 플레이어 정보
  http.get("*/api/players/:playerId/info", ({ params }) => {
    const playerId = Number(params.playerId);
    const player = playerStore.get(playerId);
    if (!player) {
      return HttpResponse.json(
        { message: "Player not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json(toPlayerRes(player));
  }),

  // POST /api/pets/gacha - 가챠 실행
  http.post("*/api/pets/gacha", async ({ request }) => {
    // Note: In real tests, we get playerId from auth context
    // For simplicity, we'll use the first player in the store
    const players = Array.from(playerStore.values());
    if (players.length === 0) {
      return HttpResponse.json(
        { message: "Player not found" },
        { status: 404 },
      );
    }

    const player = players[0];

    if (player.totalPoint < GACHA_COST) {
      return HttpResponse.json(
        { message: "Not enough points" },
        { status: 400 },
      );
    }

    // 포인트 차감
    player.totalPoint -= GACHA_COST;
    playerStore.set(player.id, player);

    // Stage 1 펫 중 랜덤 선택
    const stage1Pets = petStore.filter((p) => p.evolutionStage === 1);
    if (stage1Pets.length === 0) {
      return HttpResponse.json(
        { message: "No stage 1 pets available" },
        { status: 500 },
      );
    }

    const randomIndex = Math.floor(Math.random() * stage1Pets.length);
    const selectedPet = stage1Pets[randomIndex];

    // 도감 체크 (중복 여부)
    const codex = codexStore.get(player.id) ?? [];
    const isDuplicate = codex.includes(selectedPet.id);

    if (isDuplicate) {
      // 중복: 저장 안 함, 더미 UserPet 반환
      const dummyUserPet: UserPetEntity = {
        id: -1,
        exp: 0,
        pet: selectedPet,
      };
      return HttpResponse.json({
        userPet: toUserPetRes(dummyUserPet),
        isDuplicate: true,
      });
    }

    // 신규: UserPet 생성 및 도감 등록
    const newUserPet: UserPetEntity = {
      id: nextUserPetId++,
      exp: 0,
      pet: selectedPet,
    };

    const inventory = userPetStore.get(player.id) ?? [];
    inventory.push(newUserPet);
    userPetStore.set(player.id, inventory);

    codex.push(selectedPet.id);
    codexStore.set(player.id, codex);

    return HttpResponse.json({
      userPet: toUserPetRes(newUserPet),
      isDuplicate: false,
    });
  }),

  // POST /api/pets/gacha/refund - 가챠 환급
  http.post("*/api/pets/gacha/refund", () => {
    const players = Array.from(playerStore.values());
    if (players.length === 0) {
      return HttpResponse.json(
        { message: "Player not found" },
        { status: 404 },
      );
    }

    const player = players[0];
    const refundAmount = Math.floor(GACHA_COST / 2);
    player.totalPoint += refundAmount;
    playerStore.set(player.id, player);

    return HttpResponse.json({ refundAmount, totalPoint: player.totalPoint });
  }),

  // POST /api/pets/feed - 먹이주기
  http.post("*/api/pets/feed", async ({ request }) => {
    const body = (await request.json()) as { userPetId: number };
    const { userPetId } = body;

    // 모든 인벤토리에서 UserPet 찾기
    for (const [playerId, inventory] of userPetStore.entries()) {
      const userPet = inventory.find((up) => up.id === userPetId);
      if (userPet) {
        const player = playerStore.get(playerId);
        if (!player || player.totalPoint < FEED_COST) {
          return HttpResponse.json(
            { message: "Not enough points" },
            { status: 400 },
          );
        }

        // 만렙 체크
        if (userPet.pet.evolutionRequiredExp === 0) {
          return HttpResponse.json(
            { message: "Pet is already at max level" },
            { status: 400 },
          );
        }

        player.totalPoint -= FEED_COST;
        playerStore.set(playerId, player);

        userPet.exp = Math.min(
          userPet.exp + FEED_EXP,
          userPet.pet.evolutionRequiredExp,
        );
        return HttpResponse.json(toUserPetRes(userPet));
      }
    }

    return HttpResponse.json({ message: "UserPet not found" }, { status: 404 });
  }),

  // POST /api/pets/evolve - 진화
  http.post("*/api/pets/evolve", async ({ request }) => {
    const body = (await request.json()) as { userPetId: number };
    const { userPetId } = body;

    for (const [playerId, inventory] of userPetStore.entries()) {
      const userPet = inventory.find((up) => up.id === userPetId);
      if (userPet) {
        const currentPet = userPet.pet;

        // 진화 조건 체크
        if (currentPet.evolutionRequiredExp === 0) {
          return HttpResponse.json(
            { message: "Already max stage" },
            { status: 400 },
          );
        }
        if (userPet.exp < currentPet.evolutionRequiredExp) {
          return HttpResponse.json(
            { message: "Not enough experience" },
            { status: 400 },
          );
        }

        // 다음 단계 펫 찾기
        const nextStagePet = petStore.find(
          (p) =>
            p.species === currentPet.species &&
            p.evolutionStage === currentPet.evolutionStage + 1,
        );

        if (!nextStagePet) {
          return HttpResponse.json(
            { message: "Next evolution not found" },
            { status: 500 },
          );
        }

        // 진화 적용
        userPet.pet = nextStagePet;
        userPet.exp = 0;

        // 도감 등록
        const codex = codexStore.get(playerId) ?? [];
        if (!codex.includes(nextStagePet.id)) {
          codex.push(nextStagePet.id);
          codexStore.set(playerId, codex);
        }

        return HttpResponse.json(toUserPetRes(userPet));
      }
    }

    return HttpResponse.json({ message: "UserPet not found" }, { status: 404 });
  }),

  // PATCH /api/players/me/equipped-pet - 펫 장착
  http.patch("*/api/players/me/equipped-pet", async ({ request }) => {
    const body = (await request.json()) as { petId: number };
    const { petId } = body;

    const players = Array.from(playerStore.values());
    if (players.length === 0) {
      return HttpResponse.json(
        { message: "Player not found" },
        { status: 404 },
      );
    }

    const player = players[0];
    player.equippedPetId = petId;
    playerStore.set(player.id, player);

    return HttpResponse.json({ success: true });
  }),
];
