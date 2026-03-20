import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import { io, Socket } from 'socket.io-client';
import { DataSource, EntityTarget, Repository } from 'typeorm';

import { AuthController } from '../src/auth/auth.controller';
import { AuthProfileSyncService } from '../src/auth/auth-profile-sync.service';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { GithubGuard } from '../src/auth/github.guard';
import { JwtGuard } from '../src/auth/jwt.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PlaywrightAuthController } from '../src/auth/playwright-auth.controller';
import { User } from '../src/auth/user.interface';
import { UserStore } from '../src/auth/user.store';
import { WsJwtGuard } from '../src/auth/ws-jwt.guard';
import { BugReportController } from '../src/bugreport/bug-report.controller';
import { BugReportService } from '../src/bugreport/bug-report.service';
import { BugReport } from '../src/bugreport/entities/bug-report.entity';
import { ChatGateway } from '../src/chat/chat.gateway';
import { WriteLockService } from '../src/database/write-lock.service';
import { FocusTimeGateway } from '../src/focustime/focustime.gateway';
import { FocusTimeService } from '../src/focustime/focustime.service';
import { DailyFocusTime } from '../src/focustime/entites/daily-focus-time.entity';
import { GlobalState } from '../src/github/entities/global-state.entity';
import { GithubPollService } from '../src/github/github.poll-service';
import { ProgressGateway } from '../src/github/progress.gateway';
import { GuestbookController } from '../src/guestbook/guestbook.controller';
import { GuestbookService } from '../src/guestbook/guestbook.service';
import { Guestbook } from '../src/guestbook/entities/guestbook.entity';
import { DailyPoint } from '../src/point/entities/daily-point.entity';
import { PointController } from '../src/point/point.controller';
import { PointService } from '../src/point/point.service';
import { PointHistoryController } from '../src/pointhistory/point-history.controller';
import { PointHistoryService } from '../src/pointhistory/point-history.service';
import { PointHistory } from '../src/pointhistory/entities/point-history.entity';
import { PlayerController } from '../src/player/player.controller';
import { PlayerGateway } from '../src/player/player.gateway';
import { Player } from '../src/player/entites/player.entity';
import { PlayerService } from '../src/player/player.service';
import { RoomService } from '../src/room/room.service';
import { TaskController } from '../src/task/task.controller';
import { TaskService } from '../src/task/task.service';
import { Task } from '../src/task/entites/task.entity';
import { PetController } from '../src/userpet/pet.controller';
import { Pet } from '../src/userpet/entities/pet.entity';
import { UserPet } from '../src/userpet/entities/user-pet.entity';
import { UserPetCodex } from '../src/userpet/entities/user-pet-codex.entity';
import { PetService } from '../src/userpet/pet.service';

export const TEST_JWT_SECRET = 'test-jwt-secret-for-e2e-testing-32chars';
export const SOCKET_EVENT_TIMEOUT_MS = 5000;

export interface CreateTestAppOptions {
  database?: string;
  dropSchema?: boolean;
  githubGuardUser?: User;
  includeFocusTimeGateway?: boolean;
  includeTaskController?: boolean;
  includePointHistoryController?: boolean;
  configOverrides?: Record<string, string | number | boolean>;
  includePointController?: boolean;
  includeGuestbookController?: boolean;
  includeBugReportController?: boolean;
}

export interface TestAppContext {
  app: INestApplication;
  moduleRef: TestingModule;
  jwtService: JwtService;
  userStore: UserStore;
  baseUrl: string;
}

export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<TestAppContext> {
  const database = options.database ?? ':memory:';
  const dropSchema = options.dropSchema ?? true;
  const configOverrides = options.configOverrides ?? {};

  const githubPollServiceMock = {
    subscribeGithubEvent: jest.fn(),
    unsubscribeGithubEvent: jest.fn(),
  };

  const controllers: Array<any> = [
    AuthController,
    PlaywrightAuthController,
    PlayerController,
    PetController,
  ];
  if (options.includeTaskController) {
    controllers.push(TaskController);
  }
  if (options.includePointHistoryController) {
    controllers.push(PointHistoryController);
  }
  if (options.includePointController) {
    controllers.push(PointController);
  }
  if (options.includeGuestbookController) {
    controllers.push(GuestbookController);
  }
  if (options.includeBugReportController) {
    controllers.push(BugReportController);
  }

  const providers: Array<any> = [
    UserStore,
    AuthProfileSyncService,
    AuthSessionService,
    JwtStrategy,
    JwtGuard,
    GithubGuard,
    WsJwtGuard,
    RoomService,
    ProgressGateway,
    FocusTimeService,
    PlayerService,
    PlayerGateway,
    FocusTimeGateway,
    ChatGateway,
    PetService,
    WriteLockService,
    {
      provide: GithubPollService,
      useValue: githubPollServiceMock,
    },
  ];

  const pushProviderOnce = (...tokens: Array<any>) => {
    for (const token of tokens) {
      if (!providers.includes(token)) {
        providers.push(token);
      }
    }
  };

  if (options.includeTaskController || options.includePointHistoryController) {
    pushProviderOnce(TaskService);
  }
  if (options.includePointHistoryController) {
    pushProviderOnce(PointHistoryService);
  }
  if (options.includePointController) {
    pushProviderOnce(PointHistoryService, PointService, TaskService);
  }
  if (options.includeGuestbookController) {
    pushProviderOnce(GuestbookService);
  }
  if (options.includeBugReportController) {
    pushProviderOnce(BugReportService);
  }

  const builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            JWT_SECRET: TEST_JWT_SECRET,
            GITHUB_CLIENT_ID: 'test-client-id',
            GITHUB_CLIENT_SECRET: 'test-client-secret',
            GITHUB_CALLBACK_URL: 'http://localhost:8080/auth/github/callback',
            FRONTEND_URL: 'http://localhost:3000',
            PLAYWRIGHT_TEST_MODE: 'false',
            PLAYWRIGHT_E2E_SECRET: 'playwright-e2e-secret',
            ...configOverrides,
          }),
        ],
      }),
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database,
        synchronize: true,
        dropSchema,
        autoLoadEntities: true,
      }),
      TypeOrmModule.forFeature([
        Player,
        Task,
        DailyFocusTime,
        PointHistory,
        DailyPoint,
        Pet,
        UserPet,
        UserPetCodex,
        GlobalState,
        Guestbook,
        BugReport,
      ]),
      PassportModule,
      JwtModule.register({
        secret: TEST_JWT_SECRET,
        signOptions: { expiresIn: '1d' },
      }),
    ],
    controllers,
    providers,
  });

  if (options.githubGuardUser) {
    const guardUser = options.githubGuardUser;
    const githubGuardMock: Pick<CanActivate, 'canActivate'> = {
      canActivate(context: ExecutionContext): boolean {
        const request = context
          .switchToHttp()
          .getRequest<Request & { user?: User }>();
        request.user = guardUser;
        return true;
      },
    };
    builder.overrideGuard(GithubGuard).useValue(githubGuardMock);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  const dataSource = moduleRef.get(DataSource);

  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));

  await app.init();
  await app.listen(0);

  const originalClose = app.close.bind(app) as () => Promise<void>;
  let closed = false;
  app.close = async () => {
    if (closed) {
      return;
    }
    closed = true;

    await originalClose();

    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    await moduleRef.close();
  };

  const httpServer = app.getHttpServer() as { address(): { port: number } };
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  return {
    app,
    moduleRef,
    jwtService: moduleRef.get(JwtService),
    userStore: moduleRef.get(UserStore),
    baseUrl,
  };
}

export function getRepository<T>(
  context: TestAppContext,
  entity: EntityTarget<T>,
): Repository<T> {
  return context.moduleRef.get<Repository<T>>(getRepositoryToken(entity));
}

export interface SeedAuthenticatedPlayerOptions {
  socialId: number;
  username: string;
  nickname?: string;
  githubUsername?: string;
  totalPoint?: number;
  isNewbie?: boolean;
  avatarUrl?: string;
  accessToken?: string;
}

export interface SeedAuthenticatedPlayerResult {
  player: Player;
  user: User;
  token: string;
  cookie: string;
}

export async function seedAuthenticatedPlayer(
  context: TestAppContext,
  options: SeedAuthenticatedPlayerOptions,
): Promise<SeedAuthenticatedPlayerResult> {
  const playerRepository = getRepository(context, Player);

  const player = await playerRepository.save({
    socialId: options.socialId,
    nickname: options.nickname ?? options.username,
    githubUsername: options.githubUsername ?? options.username,
    totalPoint: options.totalPoint,
    isNewbie: options.isNewbie,
  });

  const user: User = {
    githubId: String(options.socialId),
    username: options.username,
    avatarUrl:
      options.avatarUrl ?? `https://github.com/${options.username}.png`,
    accessToken: options.accessToken ?? `test-access-token-${options.username}`,
    playerId: player.id,
  };

  context.userStore.save(user);

  const token = context.jwtService.sign({
    sub: user.githubId,
    username: user.username,
    playerId: user.playerId,
  });

  return {
    player,
    user,
    token,
    cookie: `access_token=${token}`,
  };
}

export async function createSocketClient(
  baseUrl: string,
  cookie: string,
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      extraHeaders: {
        cookie,
      },
      transports: ['websocket'],
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      cleanup();
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, SOCKET_EVENT_TIMEOUT_MS);

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };

    const onConnectError = (error: Error) => {
      cleanup();
      socket.disconnect();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
  });
}

export async function waitForSocketEvent<T>(
  socket: Socket,
  eventName: string,
  timeoutMs = SOCKET_EVENT_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const onEvent = (data: T) => {
      cleanup();
      resolve(data);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`${eventName} event timeout`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
    };

    socket.once(eventName, onEvent);
  });
}

export async function waitForNoSocketEvent(
  socket: Socket,
  eventName: string,
  waitMs = 800,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      reject(new Error(`${eventName} event should not be emitted`));
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, waitMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off(eventName, onEvent);
    };

    socket.on(eventName, onEvent);
  });
}

export interface JoinPayload {
  x: number;
  y: number;
  username: string;
  roomId?: string;
}

export interface JoinedEventPayload {
  roomId: string;
  focusTime: {
    status: 'FOCUSING' | 'RESTING';
    totalFocusSeconds: number;
    currentSessionSeconds: number;
  };
}

export async function joinRoom(
  socket: Socket,
  payload: JoinPayload,
): Promise<JoinedEventPayload> {
  const joinedPromise = waitForSocketEvent<JoinedEventPayload>(
    socket,
    'joined',
  );
  socket.emit('joining', payload);
  return joinedPromise;
}

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
