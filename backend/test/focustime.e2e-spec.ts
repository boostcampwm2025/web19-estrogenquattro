import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io-client';
import { Repository } from 'typeorm';

import { UserStore } from '../src/auth/user.store';
import {
  DailyFocusTime,
  FocusStatus,
} from '../src/focustime/entites/daily-focus-time.entity';
import { Player } from '../src/player/entites/player.entity';
import {
  TestAppContext,
  createSocketClient,
  createTestApp,
  getRepository,
  joinRoom,
} from './e2e-test-helpers';

describe('FocusTime E2E (Socket)', () => {
  let context: TestAppContext;
  let jwtService: JwtService;
  let userStore: UserStore;
  let playerRepository: Repository<Player>;
  let focusTimeRepository: Repository<DailyFocusTime>;
  let testPlayer: Player;
  let clientSocket: Socket;

  beforeAll(async () => {
    context = await createTestApp();
    jwtService = context.jwtService;
    userStore = context.userStore;
    playerRepository = getRepository(context, Player);
    focusTimeRepository = getRepository(context, DailyFocusTime);
  });

  afterAll(async () => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    await context.app.close();
  });

  beforeEach(async () => {
    // Given: 테스트 데이터가 초기화된 상태
    await focusTimeRepository.clear();
    await playerRepository.clear();

    testPlayer = await playerRepository.save({
      socialId: 12345,
      nickname: 'testuser',
    });

    userStore.save({
      githubId: '12345',
      username: 'testuser',
      avatarUrl: 'https://github.com/testuser.png',
      accessToken: 'test-access-token',
      playerId: testPlayer.id,
    });
  });

  afterEach(() => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
  });

  const createAuthedSocket = async (): Promise<Socket> => {
    const token = jwtService.sign({
      sub: '12345',
      username: 'testuser',
      playerId: testPlayer.id,
    });

    return createSocketClient(context.baseUrl, `access_token=${token}`);
  };

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

    it('휴식 상태에서는 currentSessionSeconds가 0이다', async () => {
      // Given: 오늘 FocusTime 누적값은 있지만 플레이어 상태가 RESTING인 상태
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
});
