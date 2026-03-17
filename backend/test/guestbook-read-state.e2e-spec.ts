import request from 'supertest';
import type { App } from 'supertest/types';

import {
  TestAppContext,
  createTestApp,
  getRepository,
  seedAuthenticatedPlayer,
} from './e2e-test-helpers';
import { Guestbook } from '../src/guestbook/entities/guestbook.entity';
import { getTodayKstDateString } from '../src/util/date.util';

describe('Guestbook Read State E2E', () => {
  let context: TestAppContext;

  beforeEach(async () => {
    context = await createTestApp({
      includeGuestbookController: true,
      playwrightTestMode: true,
      playwrightTestSecret: 'playwright-secret',
    });
  });

  afterEach(async () => {
    await context.app.close();
  });

  it('읽음 상태를 서버에 저장하고 같은 계정의 새 세션에서도 유지한다', async () => {
    const app = context.app.getHttpServer() as App;
    const guestbookRepository = getRepository(context, Guestbook);

    const reader = await seedAuthenticatedPlayer(context, {
      socialId: 20001,
      username: 'reader-user',
    });
    const writer = await seedAuthenticatedPlayer(context, {
      socialId: 20002,
      username: 'writer-user',
    });

    const firstEntry = await guestbookRepository.save({
      content: 'first entry',
      writeDate: getTodayKstDateString(),
      player: writer.player,
    });

    const initialState = await request(app)
      .get('/api/guestbooks/read-state')
      .set('Cookie', reader.cookie)
      .expect(200);

    expect(initialState.body).toEqual({
      latestEntryId: firstEntry.id,
      lastReadEntryId: 0,
      hasUnread: true,
    });

    const markedState = await request(app)
      .post('/api/guestbooks/read')
      .set('Cookie', reader.cookie)
      .expect(201);

    expect(markedState.body).toEqual({
      latestEntryId: firstEntry.id,
      lastReadEntryId: firstEntry.id,
      hasUnread: false,
    });

    const reloginResponse = await request(app)
      .post('/auth/test-login')
      .set('x-e2e-secret', 'playwright-secret')
      .send({
        socialId: 20001,
        username: 'reader-user',
      })
      .expect(201);

    const nextCookie = (
      reloginResponse.headers['set-cookie'] as string[] | undefined
    )
      ?.find((value) => value.startsWith('access_token='))
      ?.split(';')[0];
    expect(nextCookie).toBeDefined();

    const persistedState = await request(app)
      .get('/api/guestbooks/read-state')
      .set('Cookie', nextCookie!)
      .expect(200);

    expect(persistedState.body).toEqual({
      latestEntryId: firstEntry.id,
      lastReadEntryId: firstEntry.id,
      hasUnread: false,
    });

    await guestbookRepository.save({
      content: 'second entry',
      writeDate: '2099-01-02',
      player: writer.player,
    });

    const unreadAgainState = await request(app)
      .get('/api/guestbooks/read-state')
      .set('Cookie', nextCookie!)
      .expect(200);
    const unreadAgainBody = unreadAgainState.body as {
      latestEntryId: number | null;
      lastReadEntryId: number;
      hasUnread: boolean;
    };

    expect(unreadAgainBody).toMatchObject({
      lastReadEntryId: firstEntry.id,
      hasUnread: true,
    });
    expect(unreadAgainBody.latestEntryId).not.toBeNull();
    expect(unreadAgainBody.latestEntryId!).toBeGreaterThan(firstEntry.id);
  });
});
