import request from 'supertest';
import { Repository } from 'typeorm';

import { BugReport } from '../src/bugreport/entities/bug-report.entity';
import { Player } from '../src/player/entites/player.entity';
import {
  TestAppContext,
  createTestApp,
  getRepository,
  seedAuthenticatedPlayer,
} from './e2e-test-helpers';

describe('BugReport E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let bugReportRepository: Repository<BugReport>;

  const getHttpServer = (): Parameters<typeof request>[0] =>
    context.app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    context = await createTestApp({ includeBugReportController: true });
    playerRepository = getRepository(context, Player);
    bugReportRepository = getRepository(context, BugReport);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await bugReportRepository.clear();
    await playerRepository.clear();
  });

  it('버그 리포트를 작성하면 플레이어 정보와 함께 저장된다', async () => {
    // Given
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 33001,
      username: 'bug-reporter',
      nickname: '버그제보자',
    });

    // When
    const response = await request(getHttpServer())
      .post('/api/bug-reports')
      .set('Cookie', seeded.cookie)
      .field('content', '지도 전환 후 간헐적으로 캐릭터가 사라집니다')
      .field('diagnostics', '{"roomId":"room-1"}')
      .expect(201);

    // Then
    expect(response.body.content).toContain('캐릭터가 사라집니다');
    expect(response.body.diagnostics).toBe('{"roomId":"room-1"}');
    expect(response.body.player.nickname).toBe('버그제보자');
    expect(await bugReportRepository.count()).toBe(1);
  });

  it('내용이 500자를 넘으면 버그 리포트 작성을 거부한다', async () => {
    // Given
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 33002,
      username: 'bug-too-long',
    });

    // When
    const response = await request(getHttpServer())
      .post('/api/bug-reports')
      .set('Cookie', seeded.cookie)
      .field('content', 'a'.repeat(501))
      .expect(400);

    // Then
    expect(String(response.body.message)).toContain(
      '제보 내용은 1~500자까지 작성 가능합니다',
    );
  });

  it('인증 없이 버그 리포트 작성 시 401을 반환한다', async () => {
    await request(getHttpServer())
      .post('/api/bug-reports')
      .field('content', '로그인 없이 보내는 제보')
      .expect(401);
  });
});
