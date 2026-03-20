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

type GuestbookItemResponse = {
  id: number;
  content: string;
  player: {
    nickname: string;
  };
};

type GuestbookPageResponse = {
  items: GuestbookItemResponse[];
  nextCursor: number | null;
};

type ErrorResponse = {
  message: string | string[];
};

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
    const createdBody = created.body as GuestbookItemResponse;

    // Then
    expect(createdBody.content).toBe('첫 방명록입니다');
    expect(createdBody.player.nickname).toBe('guestbook-writer');

    // When: 같은 날 재작성
    const duplicated = await request(getHttpServer())
      .post('/api/guestbooks')
      .set('Cookie', seeded.cookie)
      .send({ content: '두 번째 방명록' })
      .expect(400);
    const duplicatedBody = duplicated.body as ErrorResponse;

    // Then
    expect(String(duplicatedBody.message)).toContain(
      '방명록은 하루에 한 번만 작성할 수 있습니다',
    );
  });

  it('작성자는 방금 작성한 방명록을 읽은 상태로 유지한다', async () => {
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 31008,
      username: 'guestbook-author',
    });

    const created = await request(getHttpServer())
      .post('/api/guestbooks')
      .set('Cookie', seeded.cookie)
      .send({ content: '내가 쓴 최신 방명록' })
      .expect(201);

    const readState = await request(getHttpServer())
      .get('/api/guestbooks/read-state')
      .set('Cookie', seeded.cookie)
      .expect(200);

    expect(created.body.id).toBeGreaterThan(0);
    expect(readState.body).toEqual({
      latestEntryId: created.body.id,
      lastReadEntryId: created.body.id,
      hasUnread: false,
    });
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

    const savedGuestbooks = await guestbookRepository.save([
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
    const firstPageBody = firstPage.body as GuestbookPageResponse;

    // Then
    expect(firstPageBody.items).toHaveLength(2);
    expect(firstPageBody.items[0].content).toBe('C');
    expect(firstPageBody.items[1].content).toBe('B');
    expect(firstPageBody.nextCursor).toBe(firstPageBody.items[1].id);

    // When: cursor 이후 ASC 조회
    const secondPage = await request(getHttpServer())
      .get(`/api/guestbooks?limit=2&order=ASC&cursor=${savedGuestbooks[0].id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);
    const secondPageBody = secondPage.body as GuestbookPageResponse;

    // Then
    expect(secondPageBody.items).toHaveLength(2);
    expect(secondPageBody.items.map((item) => item.content)).toEqual([
      'B',
      'C',
    ]);
    expect(secondPageBody.items[0].id).toBeLessThan(secondPageBody.items[1].id);
    expect(secondPageBody.nextCursor).toBeNull();
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
    const forbiddenBody = forbidden.body as ErrorResponse;

    // Then
    expect(String(forbiddenBody.message)).toContain(
      '본인이 작성한 방명록만 삭제할 수 있습니다',
    );

    // When: 작성자가 삭제
    await request(getHttpServer())
      .delete(`/api/guestbooks/${saved.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    // Then
    expect(
      await guestbookRepository.findOne({ where: { id: saved.id } }),
    ).toBeNull();
  });
});
