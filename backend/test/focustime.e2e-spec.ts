import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Socket } from 'socket.io-client';
import { Repository } from 'typeorm';

import { UserStore } from '../src/auth/user.store';
import { MAX_FOCUS_TASK_NAME_LENGTH } from '../src/focustime/focustime.constants';
import {
  DailyFocusTime,
  FocusStatus,
} from '../src/focustime/entites/daily-focus-time.entity';
import { PointType } from '../src/pointhistory/entities/point-history.entity';
import { Player } from '../src/player/entites/player.entity';
import { Task } from '../src/task/entites/task.entity';
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

type SocketAck = { success: boolean; error?: string };
type HistoryRank = { playerId: number; count: number };

const isHistoryRank = (value: unknown): value is HistoryRank => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.playerId === 'number' &&
    typeof candidate.count === 'number'
  );
};

describe('FocusTime E2E (Socket)', () => {
  let context: TestAppContext;
  let jwtService: JwtService;
  let userStore: UserStore;
  let playerRepository: Repository<Player>;
  let focusTimeRepository: Repository<DailyFocusTime>;
  let taskRepository: Repository<Task>;
  let testPlayer: Player;
  let testSocialId: number;
  let clientSocket: Socket;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    context = await createTestApp({
      includeFocusTimeGateway: true,
      includePointHistoryController: true,
    });
    jwtService = context.jwtService;
    userStore = context.userStore;
    playerRepository = getRepository(context, Player);
    focusTimeRepository = getRepository(context, DailyFocusTime);
    taskRepository = getRepository(context, Task);
  });

  afterAll(async () => {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    await context.app.close();
  });

  beforeEach(async () => {
    // Given: 테스트 데이터가 초기화된 상태
    await taskRepository.clear();
    await focusTimeRepository.clear();
    await playerRepository.clear();
    sockets = [];
    testSocialId = Math.floor(1_000_000 + Math.random() * 1_000_000_000);

    testPlayer = await playerRepository.save({
      socialId: testSocialId,
      nickname: 'testuser',
    });

    userStore.save({
      githubId: String(testSocialId),
      username: 'testuser',
      avatarUrl: 'https://github.com/testuser.png',
      accessToken: 'test-access-token',
      playerId: testPlayer.id,
    });
  });

  afterEach(() => {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    sockets = [];
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  const createAuthCookie = (): string => {
    const token = jwtService.sign({
      sub: String(testSocialId),
      username: 'testuser',
      playerId: testPlayer.id,
    });
    return `access_token=${token}`;
  };

  const createAuthedSocket = async (): Promise<Socket> => {
    return createSocketClient(context.baseUrl, createAuthCookie());
  };

  const connectAndJoin = async (
    socialId: number,
    username: string,
    roomId: string,
  ): Promise<{ socket: Socket; playerId: number }> => {
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId,
      username,
    });

    const socket = await createSocketClient(context.baseUrl, seeded.cookie);
    sockets.push(socket);

    await joinRoom(socket, {
      x: 100,
      y: 100,
      username,
      roomId,
    });

    return { socket, playerId: seeded.player.id };
  };

  const emitWithAck = async (
    socket: Socket,
    event: string,
    payload: unknown,
  ): Promise<SocketAck> =>
    new Promise((resolve) => {
      socket.emit(event, payload, (response: SocketAck) => {
        resolve(response);
      });
    });

  describe('joined 이벤트 (Bug #121)', () => {
    it('joined 이벤트에 focusTime 객체가 포함된다', async () => {
      // Given: 인증된 소켓이 연결된 상태
      clientSocket = await createAuthedSocket();

      // When: joining 이벤트로 방에 입장하면
      const joinedResponse = await joinRoom(clientSocket, {
        x: 100,
        y: 200,
        username: 'testuser',
      });

      // Then: joined 이벤트에 focusTime 객체가 포함된다
      expect(joinedResponse).toHaveProperty('roomId');
      expect(joinedResponse).toHaveProperty('focusTime');
      expect(joinedResponse.focusTime).toHaveProperty('status');
      expect(joinedResponse.focusTime).toHaveProperty('totalFocusSeconds');
      expect(joinedResponse.focusTime).toHaveProperty('currentSessionSeconds');
      expect(joinedResponse.focusTime.status).toBe('RESTING');
      expect(joinedResponse.focusTime.totalFocusSeconds).toBe(0);
      expect(joinedResponse.focusTime.currentSessionSeconds).toBe(0);
    });

    it('기존 집중 상태가 있으면 stale 세션이 정산되어 RESTING으로 복원된다', async () => {
      // Given: 플레이어가 집중 중(lastFocusStartTime 존재)이고 오늘 FocusTime 누적값이 있는 상태
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      testPlayer.lastFocusStartTime = fiveMinutesAgo;
      await playerRepository.save(testPlayer);

      await focusTimeRepository.save({
        player: testPlayer,
        totalFocusSeconds: 10,
        createdAt: new Date(),
        status: FocusStatus.FOCUSING,
      });

      clientSocket = await createAuthedSocket();

      // When: joining 이벤트로 재입장하면
      const joinedResponse = await joinRoom(clientSocket, {
        x: 100,
        y: 200,
        username: 'testuser',
      });

      // Then: stale 세션 시간이 정산되고 RESTING 상태로 복원된다
      expect(joinedResponse.focusTime.status).toBe('RESTING');
      expect(joinedResponse.focusTime.totalFocusSeconds).toBeGreaterThanOrEqual(
        305,
      );
      expect(joinedResponse.focusTime.totalFocusSeconds).toBeLessThanOrEqual(
        320,
      );
      expect(joinedResponse.focusTime.currentSessionSeconds).toBe(0);
    });

    it('stale 세션이 10분을 넘으면 joined.focusTime이 600초만 반영된다', async () => {
      // Given: 8시간 동안 stale된 집중 상태 + 기존 누적 10초
      testPlayer.lastFocusStartTime = new Date(Date.now() - 8 * 60 * 60 * 1000);
      await playerRepository.save(testPlayer);

      await focusTimeRepository.save({
        player: testPlayer,
        totalFocusSeconds: 10,
        createdAt: new Date(),
        status: FocusStatus.FOCUSING,
      });

      clientSocket = await createAuthedSocket();

      // When
      const joinedResponse = await joinRoom(clientSocket, {
        x: 100,
        y: 200,
        username: 'testuser',
      });

      // Then: stale 구간은 10분(600초)으로 클램프된다
      expect(joinedResponse.focusTime.status).toBe('RESTING');
      expect(joinedResponse.focusTime.totalFocusSeconds).toBe(610);
      expect(joinedResponse.focusTime.currentSessionSeconds).toBe(0);
    });

    it('휴식 상태에서는 currentSessionSeconds가 0이다', async () => {
      // Given: 오늘 FocusTime 누적값은 있지만 플레이어 상태가 RESTING인 상태
      testSocialId = Math.floor(2_000_000 + Math.random() * 1_000_000_000);
      testPlayer = await playerRepository.save({
        socialId: testSocialId,
        nickname: 'testuser',
      });
      userStore.save({
        githubId: String(testSocialId),
        username: 'testuser',
        avatarUrl: 'https://github.com/testuser.png',
        accessToken: 'test-access-token',
        playerId: testPlayer.id,
      });

      await focusTimeRepository.save({
        player: testPlayer,
        totalFocusSeconds: 25,
        status: FocusStatus.RESTING,
        createdAt: new Date(),
        lastFocusStartTime: new Date(Date.now() - 10 * 60 * 1000),
      });

      clientSocket = await createAuthedSocket();

      // When: joining 이벤트로 입장하면
      const joinedResponse = await joinRoom(clientSocket, {
        x: 100,
        y: 200,
        username: 'testuser',
      });

      // Then: currentSessionSeconds는 0으로 반환된다
      expect(joinedResponse.focusTime.status).toBe('RESTING');
      expect(joinedResponse.focusTime.totalFocusSeconds).toBe(25);
      expect(joinedResponse.focusTime.currentSessionSeconds).toBe(0);
    });
  });

  describe('history-ranks 연계', () => {
    it('재접속 정산 후 주간 랭킹 합계와 일별 누적 합계가 일치한다', async () => {
      // Given: stale 세션(2시간) - joined에서 10분으로 클램프되어 정산되어야 한다
      testPlayer.lastFocusStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await playerRepository.save(testPlayer);
      clientSocket = await createAuthedSocket();

      const joinedResponse = await joinRoom(clientSocket, {
        x: 100,
        y: 200,
        username: 'testuser',
      });
      expect(joinedResponse.focusTime.totalFocusSeconds).toBe(600);

      const dailyRecords = await focusTimeRepository
        .createQueryBuilder('ft')
        .where('ft.player.id = :playerId', { playerId: testPlayer.id })
        .getMany();
      const dailySum = dailyRecords.reduce(
        (sum, record) => sum + record.totalFocusSeconds,
        0,
      );

      const weekendStartAt = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      // When: FOCUSED 랭킹 엔드포인트 조회
      const response = await request(context.baseUrl)
        .get('/api/history-ranks')
        .query({ type: PointType.FOCUSED, weekendStartAt })
        .set('Cookie', createAuthCookie());

      // Then: 랭킹 count와 일별 누적 합산이 일치
      expect(response.status).toBe(200);
      const body: unknown = response.body;
      const ranks = Array.isArray(body) ? body.filter(isHistoryRank) : [];
      const myRank = ranks.find((rank) => rank.playerId === testPlayer.id);
      expect(myRank?.count).toBe(dailySum);
    });
  });

  describe('taskName 바이트 제한', () => {
    it('focusing은 45bytes taskName을 허용하고 46bytes는 거부한다', async () => {
      // Given: 같은 방에 사용자 두 명이 접속
      const { socket: sender } = await connectAndJoin(
        22001,
        'focus-sender',
        'room-1',
      );
      const { socket: receiver } = await connectAndJoin(
        22002,
        'focus-receiver',
        'room-1',
      );
      const validTaskName = `${'a'.repeat(15)}${'가'.repeat(10)}`; // 45bytes
      const invalidTaskName = `${validTaskName}a`; // 46bytes

      // When: 45bytes taskName으로 focusing 전송
      const focusedPromise = waitForSocketEvent<{ taskName?: string }>(
        receiver,
        'focused',
      );
      const validAck = await emitWithAck(sender, 'focusing', {
        taskName: validTaskName,
      });
      const focused = await focusedPromise;

      // Then: 브로드캐스트 및 ack 성공
      expect(validAck.success).toBe(true);
      expect(focused.taskName).toBe(validTaskName);

      // When: 46bytes taskName으로 focusing 전송
      const noFocusedEvent = waitForNoSocketEvent(receiver, 'focused');
      const invalidAck = await emitWithAck(sender, 'focusing', {
        taskName: invalidTaskName,
      });
      await noFocusedEvent;

      // Then: ack 실패, 브로드캐스트 없음
      expect(invalidAck.success).toBe(false);
    });

    it('focus_task_updating은 45bytes taskName을 허용하고 46bytes는 거부한다', async () => {
      // Given: 같은 방에 사용자 두 명이 접속 + sender가 집중 시작
      const { socket: sender } = await connectAndJoin(
        22003,
        'focus-updater',
        'room-1',
      );
      const { socket: receiver } = await connectAndJoin(
        22004,
        'focus-observer',
        'room-1',
      );
      const validTaskName = '가'.repeat(15); // 45bytes
      const invalidTaskName = `${validTaskName}a`; // 46bytes

      const startAck = await emitWithAck(sender, 'focusing', {
        taskName: '초기 집중',
      });
      expect(startAck.success).toBe(true);

      // When: 45bytes taskName으로 focus_task_updating 전송
      const updatedPromise = waitForSocketEvent<{ taskName: string }>(
        receiver,
        'focus_task_updated',
      );
      const validAck = await emitWithAck(sender, 'focus_task_updating', {
        taskName: validTaskName,
      });
      const updated = await updatedPromise;

      // Then: 브로드캐스트 및 ack 성공
      expect(validAck.success).toBe(true);
      expect(updated.taskName).toBe(validTaskName);

      // When: 46bytes taskName으로 전송
      const noUpdatedEvent = waitForNoSocketEvent(
        receiver,
        'focus_task_updated',
      );
      const invalidAck = await emitWithAck(sender, 'focus_task_updating', {
        taskName: invalidTaskName,
      });
      await noUpdatedEvent;

      // Then: ack 실패, 브로드캐스트 없음
      expect(invalidAck.success).toBe(false);
    });

    it('players_synced/player_joined의 taskName은 45bytes로 정규화된다', async () => {
      // Given: sender의 긴 Task(description)가 존재
      const { socket: sender, playerId } = await connectAndJoin(
        22005,
        'sync-sender',
        'room-1',
      );
      const senderPlayer = await playerRepository.findOneOrFail({
        where: { id: playerId },
      });
      const longDescription = 'a'.repeat(MAX_FOCUS_TASK_NAME_LENGTH + 10);
      const task = await taskRepository.save(
        taskRepository.create({
          player: senderPlayer,
          description: longDescription,
          createdAt: new Date(),
        }),
      );

      // When: taskId 기반으로 focusing 후 새로운 사용자가 입장
      const validAck = await emitWithAck(sender, 'focusing', {
        taskId: task.id,
      });
      expect(validAck.success).toBe(true);

      const newcomerSeed = await seedAuthenticatedPlayer(context, {
        socialId: 22006,
        username: 'sync-newcomer',
      });
      const newcomer = await createSocketClient(
        context.baseUrl,
        newcomerSeed.cookie,
      );
      sockets.push(newcomer);

      const playersSyncedPromise = waitForSocketEvent<
        Array<{ userId: string; taskName?: string | null }>
      >(newcomer, 'players_synced');
      newcomer.emit('joining', {
        x: 100,
        y: 100,
        username: 'sync-newcomer',
        roomId: 'room-1',
      });
      await waitForSocketEvent(newcomer, 'joined');
      const playersSynced = await playersSyncedPromise;

      // Then: players_synced의 taskName은 제한 이내다
      const normalizedTaskName = 'a'.repeat(MAX_FOCUS_TASK_NAME_LENGTH);
      const senderInfo = playersSynced.find(
        (player) => player.userId === sender.id,
      );
      expect(senderInfo?.taskName).toBe(normalizedTaskName);
    });
  });
});
