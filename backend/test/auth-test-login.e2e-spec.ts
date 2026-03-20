/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */

import request from 'supertest';
import { Repository } from 'typeorm';

import { Player } from '../src/player/entites/player.entity';
import {
  TestAppContext,
  createTestApp,
  getRepository,
} from './e2e-test-helpers';

const E2E_SECRET = 'playwright-secret';

function extractAccessTokenCookie(setCookie: string[] | undefined): string {
  const cookie = setCookie
    ?.find((value) => value.startsWith('access_token='))
    ?.split(';')[0];

  expect(cookie).toBeDefined();
  return cookie!;
}

async function createPlaywrightContext(
  overrides: Record<string, string> = {},
): Promise<TestAppContext> {
  return createTestApp({
    configOverrides: {
      PLAYWRIGHT_TEST_MODE: 'true',
      PLAYWRIGHT_E2E_SECRET: E2E_SECRET,
      ...overrides,
    },
  });
}

describe('Auth Test Login E2E', () => {
  let context: TestAppContext | undefined;

  afterEach(async () => {
    if (context) {
      await context.app.close();
      context = undefined;
    }
  });

  it('테스트 전용 로그인 엔드포인트가 플레이어와 UserStore를 함께 시드하고 JWT 쿠키를 발급한다', async () => {
    context = await createPlaywrightContext();
    const playerRepository: Repository<Player> = getRepository(context, Player);

    const response = await request(context.app.getHttpServer())
      .post('/auth/test-login')
      .set('x-e2e-secret', E2E_SECRET)
      .send({
        socialId: 56401,
        username: 'playwright-user',
        nickname: 'Playwright User',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      githubId: '56401',
      username: 'playwright-user',
      avatarUrl: 'https://github.com/playwright-user.png',
    });
    expect((response.headers['set-cookie'] as string[]).join(';')).toContain(
      'access_token=',
    );

    const player = await playerRepository.findOneBy({ socialId: 56401 });
    expect(player?.nickname).toBe('Playwright User');

    const accessTokenCookie = extractAccessTokenCookie(
      response.headers['set-cookie'] as string[] | undefined,
    );
    const meResponse = await request(context.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', accessTokenCookie)
      .expect(200);

    expect(meResponse.body).toMatchObject({
      githubId: '56401',
      username: 'playwright-user',
      playerId: player?.id,
    });
  });

  it('잘못된 x-e2e-secret 헤더로는 테스트 전용 로그인 엔드포인트를 호출할 수 없다', async () => {
    context = await createPlaywrightContext();

    const response = await request(context.app.getHttpServer())
      .post('/auth/test-login')
      .set('x-e2e-secret', 'wrong-secret')
      .send({
        socialId: 56402,
        username: 'playwright-user',
      })
      .expect(403);

    expect(response.body.message).toBe('Invalid x-e2e-secret');
  });

  it('PLAYWRIGHT_TEST_MODE가 비활성화되면 테스트 전용 로그인 엔드포인트가 숨겨진다', async () => {
    context = await createTestApp({
      configOverrides: {
        PLAYWRIGHT_TEST_MODE: 'false',
        PLAYWRIGHT_E2E_SECRET: E2E_SECRET,
      },
    });

    await request(context.app.getHttpServer())
      .post('/auth/test-login')
      .set('x-e2e-secret', E2E_SECRET)
      .send({
        socialId: 56403,
        username: 'playwright-user',
      })
      .expect(404);
  });

  it('백엔드가 재시작되어도 테스트 로그인 setup을 다시 실행해 동일 사용자 세션을 재생성할 수 있다', async () => {
    const seedRequest = {
      socialId: 56404,
      username: 'playwright-restart-user',
      nickname: 'Restart User',
    };

    context = await createPlaywrightContext();
    const firstResponse = await request(context.app.getHttpServer())
      .post('/auth/test-login')
      .set('x-e2e-secret', E2E_SECRET)
      .send(seedRequest)
      .expect(200);
    const firstCookie = extractAccessTokenCookie(
      firstResponse.headers['set-cookie'] as string[] | undefined,
    );

    await request(context.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', firstCookie)
      .expect(200);

    await context.app.close();
    context = undefined;

    const restartedContext = await createPlaywrightContext();
    try {
      const restartedResponse = await request(
        restartedContext.app.getHttpServer(),
      )
        .post('/auth/test-login')
        .set('x-e2e-secret', E2E_SECRET)
        .send(seedRequest)
        .expect(200);
      const restartedCookie = extractAccessTokenCookie(
        restartedResponse.headers['set-cookie'] as string[] | undefined,
      );

      const meResponse = await request(restartedContext.app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', restartedCookie)
        .expect(200);

      expect(meResponse.body).toMatchObject({
        githubId: '56404',
        username: 'playwright-restart-user',
      });
    } finally {
      await restartedContext.app.close();
    }
  });
});
