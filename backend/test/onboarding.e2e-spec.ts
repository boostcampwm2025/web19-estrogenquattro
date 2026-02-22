/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import request from 'supertest';
import { Repository } from 'typeorm';

import { Player } from '../src/player/entites/player.entity';
import {
  TestAppContext,
  createTestApp,
  getRepository,
  seedAuthenticatedPlayer,
} from './e2e-test-helpers';

describe('Onboarding E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;

  beforeAll(async () => {
    context = await createTestApp();
    playerRepository = getRepository(context, Player);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await playerRepository.clear();
  });

  it('온보딩 완료 API를 호출하면 isNewbie가 false로 변경된다', async () => {
    // Given: 신규 사용자(isNewbie=true)가 인증된 상태
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 11001,
      username: 'onboarding-user',
      isNewbie: true,
    });

    // When: PATCH /api/players/newbie를 호출하면
    await request(context.app.getHttpServer())
      .patch('/api/players/newbie')
      .set('Cookie', seeded.cookie)
      .expect(200)
      .expect({ success: true });

    // Then: DB에서 isNewbie가 false로 반영된다
    const updatedPlayer = await playerRepository.findOneByOrFail({
      id: seeded.player.id,
    });
    expect(updatedPlayer.isNewbie).toBe(false);
  });

  it('온보딩 완료 API를 재호출해도 idempotent하게 성공한다', async () => {
    // Given: 인증된 신규 사용자가 존재하는 상태
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 11002,
      username: 'onboarding-idempotent',
      isNewbie: true,
    });

    // When: PATCH /api/players/newbie를 두 번 호출하면
    await request(context.app.getHttpServer())
      .patch('/api/players/newbie')
      .set('Cookie', seeded.cookie)
      .expect(200)
      .expect({ success: true });

    await request(context.app.getHttpServer())
      .patch('/api/players/newbie')
      .set('Cookie', seeded.cookie)
      .expect(200)
      .expect({ success: true });

    // Then: 상태는 계속 false로 유지된다
    const updatedPlayer = await playerRepository.findOneByOrFail({
      id: seeded.player.id,
    });
    expect(updatedPlayer.isNewbie).toBe(false);
  });

  it('인증 없이 온보딩 완료 API를 호출하면 401을 반환한다', async () => {
    // Given: 인증 쿠키가 없는 요청

    // When: PATCH /api/players/newbie를 호출하면
    const response = await request(context.app.getHttpServer())
      .patch('/api/players/newbie')
      .expect(401);

    // Then: Unauthorized 응답을 반환한다
    expect(response.body.statusCode).toBe(401);
  });
});
