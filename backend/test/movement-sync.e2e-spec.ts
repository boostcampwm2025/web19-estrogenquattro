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
  waitForNoSocketEvent,
  waitForSocketEvent,
} from './e2e-test-helpers';

describe('Movement Sync E2E', () => {
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

  const connectAndJoin = async (
    socialId: number,
    username: string,
    roomId: string,
  ): Promise<Socket> => {
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId,
      username,
    });

    const socket = await createSocketClient(context.baseUrl, seeded.cookie);
    sockets.push(socket);

    await joinRoom(socket, {
      x: 200,
      y: 300,
      username,
      roomId,
    });

    return socket;
  };

  it('같은 방 사용자가 moving을 전송하면 다른 사용자가 moved를 수신한다', async () => {
    // Given: 같은 방(room-1)에 사용자 두 명이 접속한 상태
    const mover = await connectAndJoin(31001, 'move-sender', 'room-1');
    const observer = await connectAndJoin(31002, 'move-observer', 'room-1');

    // When: 한 사용자가 moving 이벤트를 전송하면
    const movedPromise = waitForSocketEvent<{
      userId: string;
      x: number;
      y: number;
      isMoving: boolean;
      direction: 'up' | 'down' | 'left' | 'right';
      timestamp: number;
    }>(observer, 'moved');

    mover.emit('moving', {
      x: 444,
      y: 555,
      isMoving: true,
      direction: 'right',
      timestamp: Date.now(),
    });

    // Then: 같은 방의 다른 사용자가 moved 이벤트를 수신한다
    const moved = await movedPromise;
    expect(moved.userId).toBe(mover.id);
    expect(moved.x).toBe(444);
    expect(moved.y).toBe(555);
    expect(moved.isMoving).toBe(true);
    expect(moved.direction).toBe('right');
  });

  it('다른 방 사용자에게는 moved 이벤트가 전파되지 않는다', async () => {
    // Given: 송신자와 수신자가 서로 다른 방에 접속한 상태
    const mover = await connectAndJoin(31003, 'move-isolated-sender', 'room-1');
    const isolatedObserver = await connectAndJoin(
      31004,
      'move-isolated-observer',
      'room-2',
    );

    // When: room-1 사용자가 moving 이벤트를 전송하면
    const noEventPromise = waitForNoSocketEvent(isolatedObserver, 'moved');
    mover.emit('moving', {
      x: 111,
      y: 222,
      isMoving: true,
      direction: 'left',
      timestamp: Date.now(),
    });

    // Then: room-2 사용자는 moved 이벤트를 수신하지 않는다
    await noEventPromise;
  });

  it('같은 방 사용자가 연결을 종료하면 player_left가 브로드캐스트된다', async () => {
    // Given: 같은 방(room-1)에 사용자 두 명이 접속한 상태
    const leavingUser = await connectAndJoin(
      31005,
      'move-leaving-user',
      'room-1',
    );
    const leavingUserId = leavingUser.id;
    const observer = await connectAndJoin(
      31006,
      'move-left-observer',
      'room-1',
    );

    // When: 한 사용자가 연결을 종료하면
    const playerLeftPromise = waitForSocketEvent<{ userId: string }>(
      observer,
      'player_left',
    );
    leavingUser.disconnect();

    // Then: 같은 방 사용자에게 player_left 이벤트가 전송된다
    const playerLeft = await playerLeftPromise;
    expect(playerLeft.userId).toBe(leavingUserId);
  });
});
