/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import request from 'supertest';
import { Repository } from 'typeorm';
import { Socket } from 'socket.io-client';

import { Player } from '../src/player/entites/player.entity';
import { Pet } from '../src/userpet/entities/pet.entity';
import { UserPet } from '../src/userpet/entities/user-pet.entity';
import { UserPetCodex } from '../src/userpet/entities/user-pet-codex.entity';
import {
  TestAppContext,
  createSocketClient,
  createTestApp,
  getRepository,
  joinRoom,
  seedAuthenticatedPlayer,
  waitForSocketEvent,
} from './e2e-test-helpers';

describe('Pet System E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let petRepository: Repository<Pet>;
  let userPetRepository: Repository<UserPet>;
  let userPetCodexRepository: Repository<UserPetCodex>;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    context = await createTestApp();
    playerRepository = getRepository(context, Player);
    petRepository = getRepository(context, Pet);
    userPetRepository = getRepository(context, UserPet);
    userPetCodexRepository = getRepository(context, UserPetCodex);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await userPetCodexRepository.clear();
    await userPetRepository.clear();
    await playerRepository.clear();
    await petRepository.clear();
    sockets = [];
  });

  afterEach(() => {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
  });

  const seedPetMasters = async (): Promise<{ stage1: Pet; stage2: Pet }> => {
    const stage1 = await petRepository.save({
      name: 'Gopher Stage 1',
      description: 'Stage 1 pet',
      species: 'gopher',
      evolutionStage: 1,
      evolutionRequiredExp: 20,
      actualImgUrl: '/assets/pets/gopher-stage1.png',
      silhouetteImgUrl: '/assets/pets/gopher-stage1-shadow.png',
    });

    const stage2 = await petRepository.save({
      name: 'Gopher Stage 2',
      description: 'Stage 2 pet',
      species: 'gopher',
      evolutionStage: 2,
      evolutionRequiredExp: 0,
      actualImgUrl: '/assets/pets/gopher-stage2.png',
      silhouetteImgUrl: '/assets/pets/gopher-stage2-shadow.png',
    });

    return { stage1, stage2 };
  };

  it('가챠를 실행하면 포인트가 차감되고 인벤토리에 반영된다', async () => {
    // Given: Stage 1 펫 마스터와 충분한 포인트를 가진 사용자가 준비된 상태
    const { stage1 } = await seedPetMasters();
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 41001,
      username: 'pet-gacha-user',
      totalPoint: 200,
    });

    // When: POST /api/pets/gacha를 호출하면
    const gachaResponse = await request(context.app.getHttpServer())
      .post('/api/pets/gacha')
      .set('Cookie', seeded.cookie)
      .expect(201);

    // Then: 포인트가 차감되고 인벤토리에 획득 펫이 반영된다
    expect(gachaResponse.body.isDuplicate).toBe(false);
    expect(gachaResponse.body.userPet.pet.id).toBe(stage1.id);

    const updatedPlayer = await playerRepository.findOneByOrFail({
      id: seeded.player.id,
    });
    expect(updatedPlayer.totalPoint).toBe(100);

    const inventoryResponse = await request(context.app.getHttpServer())
      .get(`/api/pets/inventory/${seeded.player.id}`)
      .set('Cookie', seeded.cookie)
      .expect(200);

    expect(Array.isArray(inventoryResponse.body)).toBe(true);
    expect(inventoryResponse.body).toHaveLength(1);
    expect(inventoryResponse.body[0].pet.id).toBe(stage1.id);
  });

  it('중복 가챠 후 환급 API를 호출하면 포인트가 환급된다', async () => {
    // Given: Stage 1 펫이 하나뿐이고 포인트가 충분한 사용자가 있는 상태
    await seedPetMasters();
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 41002,
      username: 'pet-duplicate-user',
      totalPoint: 300,
    });

    await request(context.app.getHttpServer())
      .post('/api/pets/gacha')
      .set('Cookie', seeded.cookie)
      .expect(201);

    // When: 동일 사용자가 다시 가챠 후 환급 API를 호출하면
    const duplicateGachaResponse = await request(context.app.getHttpServer())
      .post('/api/pets/gacha')
      .set('Cookie', seeded.cookie)
      .expect(201);

    const refundResponse = await request(context.app.getHttpServer())
      .post('/api/pets/gacha/refund')
      .set('Cookie', seeded.cookie)
      .expect(201);

    // Then: 중복 가챠로 판정되고 환급 금액이 플레이어 포인트에 반영된다
    expect(duplicateGachaResponse.body.isDuplicate).toBe(true);
    expect(duplicateGachaResponse.body.userPet.id).toBe(-1);
    expect(refundResponse.body.refundAmount).toBe(50);

    const updatedPlayer = await playerRepository.findOneByOrFail({
      id: seeded.player.id,
    });
    expect(updatedPlayer.totalPoint).toBe(150);

    const inventoryResponse = await request(context.app.getHttpServer())
      .get(`/api/pets/inventory/${seeded.player.id}`)
      .set('Cookie', seeded.cookie)
      .expect(200);
    expect(inventoryResponse.body).toHaveLength(1);
  });

  it('먹이주기와 진화 조건을 만족하면 다음 단계로 진화한다', async () => {
    // Given: Stage 1/2 펫 마스터와 충분한 포인트를 가진 사용자가 준비된 상태
    const { stage1, stage2 } = await seedPetMasters();
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 41003,
      username: 'pet-evolve-user',
      totalPoint: 300,
    });

    const gachaResponse = await request(context.app.getHttpServer())
      .post('/api/pets/gacha')
      .set('Cookie', seeded.cookie)
      .expect(201);

    const userPetId = gachaResponse.body.userPet.id as number;
    expect(gachaResponse.body.userPet.pet.id).toBe(stage1.id);

    // When: 경험치 부족 상태에서 진화를 시도한 뒤 먹이주기 후 다시 진화를 시도하면
    await request(context.app.getHttpServer())
      .post('/api/pets/evolve')
      .set('Cookie', seeded.cookie)
      .send({ userPetId })
      .expect(400);

    await request(context.app.getHttpServer())
      .post('/api/pets/feed')
      .set('Cookie', seeded.cookie)
      .send({ userPetId })
      .expect(201);

    await request(context.app.getHttpServer())
      .post('/api/pets/feed')
      .set('Cookie', seeded.cookie)
      .send({ userPetId })
      .expect(201);

    const evolveResponse = await request(context.app.getHttpServer())
      .post('/api/pets/evolve')
      .set('Cookie', seeded.cookie)
      .send({ userPetId })
      .expect(201);

    // Then: 펫이 다음 단계로 변경되고 도감에도 새 단계가 반영된다
    expect(evolveResponse.body.pet.id).toBe(stage2.id);
    expect(evolveResponse.body.exp).toBe(0);

    const codexResponse = await request(context.app.getHttpServer())
      .get(`/api/pets/codex/${seeded.player.id}`)
      .set('Cookie', seeded.cookie)
      .expect(200);

    expect(codexResponse.body).toEqual(
      expect.arrayContaining([stage1.id, stage2.id]),
    );
  });

  it('펫 장착 후 pet_equipping을 보내면 같은 방 사용자에게 pet_equipped가 전파된다', async () => {
    // Given: 펫을 보유하고 장착한 사용자와 같은 방의 다른 사용자가 접속한 상태
    const { stage1 } = await seedPetMasters();

    const owner = await seedAuthenticatedPlayer(context, {
      socialId: 41004,
      username: 'pet-owner',
      totalPoint: 200,
    });
    const observer = await seedAuthenticatedPlayer(context, {
      socialId: 41005,
      username: 'pet-observer',
      totalPoint: 200,
    });

    await request(context.app.getHttpServer())
      .post('/api/pets/gacha')
      .set('Cookie', owner.cookie)
      .expect(201);

    await request(context.app.getHttpServer())
      .patch('/api/players/me/equipped-pet')
      .set('Cookie', owner.cookie)
      .send({ petId: stage1.id })
      .expect(200)
      .expect({ success: true });

    const ownerSocket = await createSocketClient(context.baseUrl, owner.cookie);
    sockets.push(ownerSocket);
    await joinRoom(ownerSocket, {
      x: 400,
      y: 400,
      username: owner.user.username,
      roomId: 'room-1',
    });

    const observerSocket = await createSocketClient(
      context.baseUrl,
      observer.cookie,
    );
    sockets.push(observerSocket);
    await joinRoom(observerSocket, {
      x: 420,
      y: 420,
      username: observer.user.username,
      roomId: 'room-1',
    });

    // When: 장착한 사용자가 pet_equipping 이벤트를 전송하면
    const petEquippedPromise = waitForSocketEvent<{
      userId: string;
      petImage: string | null;
    }>(observerSocket, 'pet_equipped');
    ownerSocket.emit('pet_equipping', { petId: stage1.id });

    // Then: 같은 방 사용자에게 pet_equipped 이벤트가 브로드캐스트된다
    const petEquipped = await petEquippedPromise;
    expect(petEquipped.userId).toBe(ownerSocket.id);
    expect(petEquipped.petImage).toBe(stage1.actualImgUrl);
  });

  it('포인트가 부족하면 가챠와 먹이주기가 400을 반환한다', async () => {
    // Given: 가챠/먹이주기 비용을 만족하지 못하는 사용자가 준비된 상태
    await seedPetMasters();

    const lowGachaUser = await seedAuthenticatedPlayer(context, {
      socialId: 41006,
      username: 'pet-low-gacha',
      totalPoint: 90,
    });

    const lowFeedUser = await seedAuthenticatedPlayer(context, {
      socialId: 41007,
      username: 'pet-low-feed',
      totalPoint: 109,
    });

    const gachaForLowFeed = await request(context.app.getHttpServer())
      .post('/api/pets/gacha')
      .set('Cookie', lowFeedUser.cookie)
      .expect(201);

    // When: 포인트 부족 상태에서 가챠/먹이주기를 호출하면
    const gachaFailResponse = await request(context.app.getHttpServer())
      .post('/api/pets/gacha')
      .set('Cookie', lowGachaUser.cookie)
      .expect(400);

    const feedFailResponse = await request(context.app.getHttpServer())
      .post('/api/pets/feed')
      .set('Cookie', lowFeedUser.cookie)
      .send({ userPetId: gachaForLowFeed.body.userPet.id })
      .expect(400);

    // Then: 두 API 모두 400을 반환한다
    expect(gachaFailResponse.body.message).toBe('Not enough points');
    expect(feedFailResponse.body.message).toBe('Not enough points');
  });

  it('미보유 펫을 장착하면 400을 반환한다', async () => {
    // Given: 펫 마스터는 존재하지만 해당 펫을 수집하지 않은 사용자가 준비된 상태
    const { stage1 } = await seedPetMasters();
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 41008,
      username: 'pet-not-owned',
      totalPoint: 100,
    });

    // When: 미보유 펫을 장착하면
    const response = await request(context.app.getHttpServer())
      .patch('/api/players/me/equipped-pet')
      .set('Cookie', seeded.cookie)
      .send({ petId: stage1.id })
      .expect(400);

    // Then: 도감 미보유 오류를 반환한다
    expect(response.body.message).toBe('You do not own this pet');
  });
});
