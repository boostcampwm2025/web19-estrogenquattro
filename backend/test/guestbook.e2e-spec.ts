import request from 'supertest';
import { Repository } from 'typeorm';

import { Guestbook } from '../src/guestbook/entities/guestbook.entity';
import { Player } from '../src/player/entites/player.entity';
import {
  TestAppContext,
  createTestApp,
  getRepository,
  seedAuthenticatedPlayer,
} from './e2e-test-helpers';

describe('Guestbook E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let guestbookRepository: Repository<Guestbook>;

  const getHttpServer = (): Parameters<typeof request>[0] =>
    context.app.getHttpServer() as Parameters<typeof request>[0];

  beforeAll(async () => {
    context = await createTestApp({ includeGuestbookController: true });
    playerRepository = getRepository(context, Player);
    guestbookRepository = getRepository(context, Guestbook);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await guestbookRepository.clear();
    await playerRepository.clear();
  });

  it('방명록 작성 시 공백이 trim되고 같은 날 중복 작성은 거부된다', async () => {
    // Given
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 31001,
      username: 'guestbook-writer',
    });

    // When: 정상 작성
    const created = await request(getHttpServer())
      .post('/api/guestbooks')
      .set('Cookie', seeded.cookie)
      .send({ content: '  첫 방명록입니다  ' })
      .expect(201);

    // Then
    expect(created.body.content).toBe('첫 방명록입니다');
    expect(created.body.player.nickname).toBe('guestbook-writer');

    // When: 같은 날 재작성
    const duplicated = await request(getHttpServer())
      .post('/api/guestbooks')
      .set('Cookie', seeded.cookie)
      .send({ content: '두 번째 방명록' })
      .expect(400);

    // Then
    expect(String(duplicated.body.message)).toContain(
      '방명록은 하루에 한 번만 작성할 수 있습니다',
    );
  });

  it('cursor와 order를 사용해 방명록을 페이지네이션 조회한다', async () => {
    // Given
    const viewer = await seedAuthenticatedPlayer(context, {
      socialId: 31002,
      username: 'guestbook-viewer',
    });
    const writerA = await seedAuthenticatedPlayer(context, {
      socialId: 31003,
      username: 'writer-a',
    });
    const writerB = await seedAuthenticatedPlayer(context, {
      socialId: 31004,
      username: 'writer-b',
    });
    const writerC = await seedAuthenticatedPlayer(context, {
      socialId: 31005,
      username: 'writer-c',
    });

    await guestbookRepository.save([
      {
        content: 'A',
        writeDate: '2026-03-17',
        player: writerA.player,
      },
      {
        content: 'B',
        writeDate: '2026-03-16',
        player: writerB.player,
      },
      {
        content: 'C',
        writeDate: '2026-03-15',
        player: writerC.player,
      },
    ]);

    // When: 최신순 2개 조회
    const firstPage = await request(getHttpServer())
      .get('/api/guestbooks?limit=2&order=DESC')
      .set('Cookie', viewer.cookie)
      .expect(200);

    // Then
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.items[0].content).toBe('C');
    expect(firstPage.body.items[1].content).toBe('B');
    expect(firstPage.body.nextCursor).toBe(firstPage.body.items[1].id);

    // When: cursor 이후 ASC 조회
    const secondPage = await request(getHttpServer())
      .get(`/api/guestbooks?limit=2&order=ASC&cursor=${firstPage.body.items[0].id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    // Then
    expect(Array.isArray(secondPage.body.items)).toBe(true);
  });

  it('본인이 작성한 방명록만 삭제할 수 있다', async () => {
    // Given
    const owner = await seedAuthenticatedPlayer(context, {
      socialId: 31006,
      username: 'guestbook-owner',
    });
    const other = await seedAuthenticatedPlayer(context, {
      socialId: 31007,
      username: 'guestbook-other',
    });
    const saved = await guestbookRepository.save({
      content: '삭제 대상',
      writeDate: '2026-03-17',
      player: owner.player,
    });

    // When: 다른 사용자가 삭제
    const forbidden = await request(getHttpServer())
      .delete(`/api/guestbooks/${saved.id}`)
      .set('Cookie', other.cookie)
      .expect(403);

    // Then
    expect(String(forbidden.body.message)).toContain(
      '본인이 작성한 방명록만 삭제할 수 있습니다',
    );

    // When: 작성자가 삭제
    await request(getHttpServer())
      .delete(`/api/guestbooks/${saved.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    // Then
    expect(await guestbookRepository.findOne({ where: { id: saved.id } })).toBeNull();
  });
});
