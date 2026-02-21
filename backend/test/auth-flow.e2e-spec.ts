/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import request from 'supertest';
import { Repository } from 'typeorm';

import { User } from '../src/auth/user.interface';
import { Player } from '../src/player/entites/player.entity';
import {
  TestAppContext,
  createTestApp,
  getRepository,
} from './e2e-test-helpers';

describe('Auth Flow E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let guardUser: User;
  let authCookie: string;

  beforeAll(async () => {
    guardUser = {
      githubId: '9001',
      username: 'auth-user',
      avatarUrl: 'https://github.com/auth-user.png',
      accessToken: 'test-oauth-token',
      playerId: 0,
    };

    context = await createTestApp({ githubGuardUser: guardUser });
    playerRepository = getRepository(context, Player);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await playerRepository.clear();

    const player = await playerRepository.save({
      socialId: Number(guardUser.githubId),
      nickname: guardUser.username,
    });

    guardUser.playerId = player.id;
    context.userStore.save({ ...guardUser });

    authCookie = `access_token=${context.jwtService.sign({
      sub: guardUser.githubId,
      username: guardUser.username,
      playerId: guardUser.playerId,
    })}`;
  });

  it('GitHub 콜백이 성공하면 JWT 쿠키를 발급하고 콜백 페이지로 리다이렉트한다', async () => {
    // Given: OAuth 콜백에서 사용할 테스트 사용자가 준비된 상태

    // When: GitHub OAuth 콜백 엔드포인트를 호출하면
    const response = await request(context.app.getHttpServer())
      .get('/auth/github/callback')
      .expect(302);

    // Then: JWT 쿠키가 발급되고 프론트 콜백 URL로 리다이렉트된다
    expect(response.headers.location).toBe(
      'http://localhost:3000/auth/callback',
    );

    const setCookie = response.headers['set-cookie'] as string[] | undefined;
    expect(setCookie).toBeDefined();
    expect(setCookie?.join(';')).toContain('access_token=');
    expect(setCookie?.join(';')).toContain('HttpOnly');
  });

  it('발급된 인증 쿠키로 auth/me를 호출하면 사용자 정보를 반환한다', async () => {
    // Given: OAuth 콜백으로 JWT 쿠키를 발급받은 상태
    const callbackResponse = await request(context.app.getHttpServer())
      .get('/auth/github/callback')
      .expect(302);
    const callbackCookie = (callbackResponse.headers['set-cookie'] as string[])
      .find((cookie) => cookie.startsWith('access_token='))
      ?.split(';')[0];

    // When: 발급된 쿠키를 포함해 auth/me를 호출하면
    const response = await request(context.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', callbackCookie ?? '')
      .expect(200);

    // Then: 사용자 필수 필드를 포함한 인증 정보가 반환된다
    expect(response.body).toMatchObject({
      githubId: guardUser.githubId,
      username: guardUser.username,
      avatarUrl: guardUser.avatarUrl,
      playerId: guardUser.playerId,
    });
  });

  it('로그아웃을 호출하면 인증 쿠키를 제거하고 프론트로 리다이렉트한다', async () => {
    // Given: 로그인된 사용자가 존재하는 상태

    // When: auth/logout을 호출하면
    const response = await request(context.app.getHttpServer())
      .get('/auth/logout')
      .set('Cookie', authCookie)
      .expect(302);

    // Then: access_token 쿠키가 삭제되고 프론트 URL로 이동한다
    expect(response.headers.location).toBe('http://localhost:3000');
    expect((response.headers['set-cookie'] as string[]).join(';')).toContain(
      'access_token=;',
    );
  });

  it('인증 쿠키 없이 auth/me를 호출하면 401을 반환한다', async () => {
    // Given: 인증 쿠키가 없는 요청

    // When: auth/me를 호출하면
    const response = await request(context.app.getHttpServer())
      .get('/auth/me')
      .expect(401);

    // Then: Unauthorized 응답을 반환한다
    expect(response.body.statusCode).toBe(401);
  });

  it('만료된 인증 쿠키로 auth/me를 호출하면 401을 반환한다', async () => {
    // Given: 만료된 JWT 쿠키
    const expiredToken = context.jwtService.sign(
      {
        sub: guardUser.githubId,
        username: guardUser.username,
        playerId: guardUser.playerId,
      },
      { expiresIn: '-1s' },
    );

    // When: 만료된 쿠키로 auth/me를 호출하면
    const response = await request(context.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `access_token=${expiredToken}`)
      .expect(401);

    // Then: Unauthorized 응답을 반환한다
    expect(response.body.statusCode).toBe(401);
  });

  it('위조된 인증 쿠키로 auth/me를 호출하면 401을 반환한다', async () => {
    // Given: UserStore에 없는 githubId를 담은 JWT 쿠키
    const forgedToken = context.jwtService.sign({
      sub: '99999999',
      username: 'forged-user',
      playerId: 9999,
    });

    // When: 위조 토큰으로 auth/me를 호출하면
    const response = await request(context.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `access_token=${forgedToken}`)
      .expect(401);

    // Then: Unauthorized 응답을 반환한다
    expect(response.body.statusCode).toBe(401);
  });
});
