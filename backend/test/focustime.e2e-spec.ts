import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { io, Socket } from 'socket.io-client';
import { Repository } from 'typeorm';

import { PlayerGateway } from '../src/player/player.gateway';
import { PlayerService } from '../src/player/player.service';
import { FocusTimeModule } from '../src/focustime/focustime.module';
import { RoomModule } from '../src/room/room.module';
import { GithubModule } from '../src/github/github.module';
import { Player } from '../src/player/entites/player.entity';
import { DailyFocusTime } from '../src/focustime/entites/daily-focus-time.entity';
import { UserStore } from '../src/auth/user.store';
import { WsJwtGuard } from '../src/auth/ws-jwt.guard';
import { GithubPollService } from '../src/github/github.poll-service';
import { GithubGateway } from '../src/github/github.gateway';
import { IoAdapter } from '@nestjs/platform-socket.io';

const JWT_SECRET = 'test-jwt-secret-for-e2e-testing-32chars';

describe('FocusTime E2E (Socket)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userStore: UserStore;
  let playerRepository: Repository<Player>;
  let focusTimeRepository: Repository<DailyFocusTime>;
  let testPlayer: Player;
  let clientSocket: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET,
              GITHUB_CLIENT_ID: 'test-client-id',
              GITHUB_CLIENT_SECRET: 'test-client-secret',
              GITHUB_CALLBACK_URL: 'http://localhost:8080/auth/github/callback',
              FRONTEND_URL: 'http://localhost:3000',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Player, DailyFocusTime],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Player, DailyFocusTime]),
        PassportModule,
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1d' },
        }),
        RoomModule,
        GithubModule,
        FocusTimeModule,
      ],
      providers: [UserStore, WsJwtGuard, PlayerGateway, PlayerService],
    })
      .overrideProvider(GithubPollService)
      .useValue({
        subscribeGithubEvent: jest.fn(),
        unsubscribeGithubEvent: jest.fn(),
      })
      .overrideProvider(GithubGateway)
      .useValue({
        getRoomState: jest
          .fn()
          .mockReturnValue({ progress: 0, contributions: {} }),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // WebSocket 어댑터 설정 (테스트에서는 기본 IoAdapter 사용)
    app.useWebSocketAdapter(new IoAdapter(app));

    await app.init();
    await app.listen(0); // 랜덤 포트 사용

    jwtService = moduleFixture.get<JwtService>(JwtService);
    userStore = moduleFixture.get<UserStore>(UserStore);
    playerRepository = moduleFixture.get<Repository<Player>>(
      getRepositoryToken(Player),
    );
    focusTimeRepository = moduleFixture.get<Repository<DailyFocusTime>>(
      getRepositoryToken(DailyFocusTime),
    );
  });

  afterAll(async () => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    await app.close();
  });

  beforeEach(async () => {
    // 테스트 데이터 초기화
    await focusTimeRepository.clear();
    await playerRepository.clear();

    // 테스트용 플레이어 생성
    testPlayer = await playerRepository.save({
      socialId: 12345,
      nickname: 'testuser',
    });

    // UserStore에 테스트 유저 등록
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

  const createSocketClient = async (): Promise<Socket> => {
    const httpServer = app.getHttpServer() as { address(): { port: number } };
    const address = httpServer.address();
    const url = `http://127.0.0.1:${address.port}`;

    // JWT 토큰 생성
    const token = jwtService.sign({
      sub: '12345',
      username: 'testuser',
      playerId: testPlayer.id,
    });

    return new Promise((resolve, reject) => {
      const socket = io(url, {
        extraHeaders: {
          cookie: `access_token=${token}`,
        },
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect', () => {
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        reject(error);
      });

      // 타임아웃
      setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 5000);
    });
  };

  describe('joined 이벤트 (Bug #121)', () => {
    it('joined 이벤트에 focusTime 객체가 포함된다', async () => {
      // Given: 소켓 연결
      clientSocket = await createSocketClient();

      // When: joining 이벤트 전송 및 joined 응답 대기
      const joinedResponse = await new Promise<{
        roomId: string;
        focusTime: {
          status: string;
          totalFocusSeconds: number;
          currentSessionSeconds: number;
        };
      }>((resolve, reject) => {
        clientSocket.once('joined', resolve);
        clientSocket.emit('joining', { x: 100, y: 200, username: 'testuser' });
        setTimeout(() => reject(new Error('joined event timeout')), 5000);
      });

      // Then: focusTime 객체가 포함되어야 함
      expect(joinedResponse).toHaveProperty('roomId');
      expect(joinedResponse).toHaveProperty('focusTime');
      expect(joinedResponse.focusTime).toHaveProperty('status');
      expect(joinedResponse.focusTime).toHaveProperty('totalFocusSeconds');
      expect(joinedResponse.focusTime).toHaveProperty('currentSessionSeconds');

      // 초기 상태 확인
      expect(joinedResponse.focusTime.status).toBe('RESTING');
      expect(joinedResponse.focusTime.totalFocusSeconds).toBe(0);
      expect(joinedResponse.focusTime.currentSessionSeconds).toBe(0);
    });

    it('기존 집중 상태가 있으면 복원된다', async () => {
      // Given: 기존 FocusTime 레코드 생성 (집중 중 상태)
      const today = new Date().toISOString().slice(0, 10);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // V2: Player.lastFocusStartTime으로 집중 상태 판단
      testPlayer.lastFocusStartTime = fiveMinutesAgo;
      await playerRepository.save(testPlayer);

      await focusTimeRepository.save({
        player: testPlayer,
        totalFocusSeconds: 10,
        createdDate: today as unknown as Date,
      });

      // Given: 소켓 연결
      clientSocket = await createSocketClient();

      // When: joining 이벤트 전송 및 joined 응답 대기
      const joinedResponse = await new Promise<{
        roomId: string;
        focusTime: {
          status: string;
          totalFocusSeconds: number;
          currentSessionSeconds: number;
        };
      }>((resolve, reject) => {
        clientSocket.once('joined', resolve);
        clientSocket.emit('joining', { x: 100, y: 200, username: 'testuser' });
        setTimeout(() => reject(new Error('joined event timeout')), 5000);
      });

      // Then: 기존 상태가 복원되어야 함
      expect(joinedResponse.focusTime.status).toBe('FOCUSING');
      expect(joinedResponse.focusTime.totalFocusSeconds).toBe(10);

      // currentSessionSeconds는 5분(300초) 정도 (오차 허용)
      expect(
        joinedResponse.focusTime.currentSessionSeconds,
      ).toBeGreaterThanOrEqual(295);
      expect(
        joinedResponse.focusTime.currentSessionSeconds,
      ).toBeLessThanOrEqual(310);
    });

    it('휴식 상태에서는 currentSessionSeconds가 0이다', async () => {
      // Given: 기존 FocusTime 레코드 생성 (휴식 상태, lastFocusStartTime 있음)
      const today = new Date().toISOString().slice(0, 10);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      await focusTimeRepository.save({
        player: testPlayer,
        totalFocusSeconds: 25,
        status: 'RESTING',
        createdDate: today as unknown as Date,
        lastFocusStartTime: tenMinutesAgo, // 이전 집중 시작 시간 (참고용)
      });

      // Given: 소켓 연결
      clientSocket = await createSocketClient();

      // When: joining 이벤트 전송 및 joined 응답 대기
      const joinedResponse = await new Promise<{
        roomId: string;
        focusTime: {
          status: string;
          totalFocusSeconds: number;
          currentSessionSeconds: number;
        };
      }>((resolve, reject) => {
        clientSocket.once('joined', resolve);
        clientSocket.emit('joining', { x: 100, y: 200, username: 'testuser' });
        setTimeout(() => reject(new Error('joined event timeout')), 5000);
      });

      // Then: 휴식 상태에서는 currentSessionSeconds가 0
      expect(joinedResponse.focusTime.status).toBe('RESTING');
      expect(joinedResponse.focusTime.totalFocusSeconds).toBe(25);
      expect(joinedResponse.focusTime.currentSessionSeconds).toBe(0);
    });
  });

  describe('focused 이벤트', () => {
    it('집중 시작하면 DB에 FOCUSING 상태가 저장된다', async () => {
      // Given: 소켓 연결 및 방 입장
      clientSocket = await createSocketClient();

      await new Promise<void>((resolve, reject) => {
        clientSocket.once('joined', () => resolve());
        clientSocket.emit('joining', { x: 100, y: 200, username: 'testuser' });
        setTimeout(() => reject(new Error('joined event timeout')), 5000);
      });

      // When: focusing 이벤트 전송
      clientSocket.emit('focusing', { taskName: '테스트 작업' });

      // 잠시 대기 (DB 업데이트 시간)
      await new Promise((r) => setTimeout(r, 200));

      // Then: DB에 FOCUSING 상태가 저장되어야 함 (V2: Player 테이블에서 확인)
      const player = await playerRepository.findOne({
        where: { id: testPlayer.id },
      });

      expect(player).toBeDefined();
      expect(player!.lastFocusStartTime).toBeDefined();
    });

    it('disconnect 시 RESTING 상태로 변경된다', async () => {
      // Given: 소켓 연결, 방 입장, 집중 시작
      clientSocket = await createSocketClient();

      await new Promise<void>((resolve, reject) => {
        clientSocket.once('joined', () => resolve());
        clientSocket.emit('joining', { x: 100, y: 200, username: 'testuser' });
        setTimeout(() => reject(new Error('joined event timeout')), 5000);
      });

      clientSocket.emit('focusing', { taskName: '테스트 작업' });
      await new Promise((r) => setTimeout(r, 200));

      // When: disconnect
      clientSocket.disconnect();
      await new Promise((r) => setTimeout(r, 200));

      // Then: DB에 RESTING 상태로 변경되어야 함 (V2: Player 테이블에서 확인)
      const player = await playerRepository.findOne({
        where: { id: testPlayer.id },
      });

      expect(player).toBeDefined();
      expect(player!.lastFocusStartTime).toBeNull();
    });
  });
});
