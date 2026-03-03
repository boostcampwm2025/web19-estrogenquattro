import { Repository } from 'typeorm';
import { Socket } from 'socket.io-client';

import { Player } from '../src/player/entites/player.entity';
import {
  TestAppContext,
  createSocketClient,
  createTestApp,
  getRepository,
  joinRoom,
  seedAuthenticatedPlayer,
  waitForSocketEvent,
} from './e2e-test-helpers';

describe('Session Replacement E2E', () => {
  let context: TestAppContext;
  let playerRepository: Repository<Player>;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    context = await createTestApp();
    playerRepository = getRepository(context, Player);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await playerRepository.clear();
    sockets = [];
  });

  afterEach(() => {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
  });

  it('username이 바뀌어도 동일 githubId 재접속 시 기존 세션을 교체한다', async () => {
    // Given: 기존 username으로 먼저 접속한 세션
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId: 52001,
      username: 'session-user-old',
    });

    const oldSocket = await createSocketClient(context.baseUrl, seeded.cookie);
    sockets.push(oldSocket);
    await joinRoom(oldSocket, {
      x: 100,
      y: 100,
      username: 'session-user-old',
      roomId: 'room-1',
    });

    // Given: 같은 githubId로 username이 변경된 상태
    const renamedUser = {
      ...seeded.user,
      username: 'session-user-new',
      avatarUrl: 'https://github.com/session-user-new.png',
      accessToken: 'test-access-token-session-user-new',
    };
    context.userStore.save(renamedUser);

    const renamedToken = context.jwtService.sign({
      sub: renamedUser.githubId,
      username: renamedUser.username,
      playerId: renamedUser.playerId,
    });
    const renamedCookie = `access_token=${renamedToken}`;

    const sessionReplacedPromise = waitForSocketEvent<{ message: string }>(
      oldSocket,
      'session_replaced',
    );
    const disconnectedPromise = waitForSocketEvent<string>(
      oldSocket,
      'disconnect',
    );

    // When: 변경된 username으로 재접속하면
    const newSocket = await createSocketClient(context.baseUrl, renamedCookie);
    sockets.push(newSocket);
    await joinRoom(newSocket, {
      x: 110,
      y: 110,
      username: 'session-user-new',
      roomId: 'room-1',
    });

    // Then: 기존 세션은 교체되고 새 세션만 유지된다
    const sessionReplaced = await sessionReplacedPromise;
    const disconnectReason = await disconnectedPromise;

    expect(sessionReplaced.message).toContain('다른 탭에서 접속');
    expect(disconnectReason).toBe('io server disconnect');
    expect(oldSocket.connected).toBe(false);
    expect(newSocket.connected).toBe(true);
  });
});
