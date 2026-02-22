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
import { EntityTarget, Repository } from 'typeorm';

import { AuthController } from '../src/auth/auth.controller';
import { GithubGuard } from '../src/auth/github.guard';
import { JwtGuard } from '../src/auth/jwt.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { User } from '../src/auth/user.interface';
import { UserStore } from '../src/auth/user.store';
import { WsJwtGuard } from '../src/auth/ws-jwt.guard';
import { ChatGateway } from '../src/chat/chat.gateway';
import { WriteLockService } from '../src/database/write-lock.service';
import { FocusTimeService } from '../src/focustime/focustime.service';
import { DailyFocusTime } from '../src/focustime/entites/daily-focus-time.entity';
import { GlobalState } from '../src/github/entities/global-state.entity';
import { GithubPollService } from '../src/github/github.poll-service';
import { ProgressGateway } from '../src/github/progress.gateway';
import { PlayerController } from '../src/player/player.controller';
import { PlayerGateway } from '../src/player/player.gateway';
import { Player } from '../src/player/entites/player.entity';
import { PlayerService } from '../src/player/player.service';
import { RoomService } from '../src/room/room.service';
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

  const githubPollServiceMock = {
    subscribeGithubEvent: jest.fn(),
    unsubscribeGithubEvent: jest.fn(),
  };

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
        Pet,
        UserPet,
        UserPetCodex,
        GlobalState,
      ]),
      PassportModule,
      JwtModule.register({
        secret: TEST_JWT_SECRET,
        signOptions: { expiresIn: '1d' },
      }),
    ],
    controllers: [AuthController, PlayerController, PetController],
    providers: [
      UserStore,
      JwtStrategy,
      JwtGuard,
      GithubGuard,
      WsJwtGuard,
      RoomService,
      ProgressGateway,
      FocusTimeService,
      PlayerService,
      PlayerGateway,
      ChatGateway,
      PetService,
      WriteLockService,
      {
        provide: GithubPollService,
        useValue: githubPollServiceMock,
      },
    ],
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

  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));

  await app.init();
  await app.listen(0);

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
