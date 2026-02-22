import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Socket } from 'socket.io-client';
import { Repository } from 'typeorm';

import { Player } from '../src/player/entites/player.entity';
import {
  ProgressGateway,
  ProgressSource,
} from '../src/github/progress.gateway';
import {
  TestAppContext,
  createSocketClient,
  createTestApp,
  delay,
  getRepository,
  seedAuthenticatedPlayer,
  waitForSocketEvent,
} from './e2e-test-helpers';

describe('Progress & Season E2E', () => {
  let context: TestAppContext;
  let progressGateway: ProgressGateway;
  let playerRepository: Repository<Player>;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    context = await createTestApp();
    progressGateway = context.moduleRef.get(ProgressGateway);
    playerRepository = getRepository(context, Player);
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(async () => {
    await playerRepository.clear();
    await progressGateway.resetSeason();
    sockets = [];
  });

  afterEach(() => {
    sockets.forEach((socket) => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
  });

  const connectObserverSocket = async (
    socialId: number,
    username: string,
  ): Promise<Socket> => {
    const seeded = await seedAuthenticatedPlayer(context, {
      socialId,
      username,
    });

    const socket = await createSocketClient(context.baseUrl, seeded.cookie);
    sockets.push(socket);
    return socket;
  };

  it('임계치 직전/도달/초과 구간에서 map_switch와 progress 리셋이 동작한다', () => {
    // Given: map_switch emit 호출을 관찰하는 상태
    const emitSpy = jest.spyOn(progressGateway.server, 'emit');

    // When: 임계치 직전(199), 도달(+1), 초과(+300) 순으로 progress를 가산하면
    progressGateway.addProgress('progress-observer', ProgressSource.TASK, 199);

    progressGateway.addProgress('progress-observer', ProgressSource.TASK, 1);
    progressGateway.addProgress('progress-observer', ProgressSource.TASK, 300);

    // Then: 맵 전환이 두 번 발생하고 progress는 리셋된다
    const mapSwitchCalls = emitSpy.mock.calls.filter(
      (call) => call[0] === 'map_switch',
    );
    expect(mapSwitchCalls).toHaveLength(2);
    expect(mapSwitchCalls[0][1]).toEqual({ mapIndex: 1 });
    expect(mapSwitchCalls[1][1]).toEqual({ mapIndex: 2 });

    const state = progressGateway.getGlobalState();
    expect(state.mapIndex).toBe(2);
    expect(state.progress).toBe(0);
    emitSpy.mockRestore();
  });

  it('마지막 맵에서는 progress가 상한값으로 clamp되고 추가 map_switch가 발생하지 않는다', async () => {
    // Given: 전환을 통해 마지막 맵(mapIndex=4)에 도달한 상태
    await connectObserverSocket(51002, 'progress-last-map');

    progressGateway.addProgress('progress-last-map', ProgressSource.TASK, 200);
    progressGateway.addProgress('progress-last-map', ProgressSource.TASK, 300);
    progressGateway.addProgress('progress-last-map', ProgressSource.TASK, 400);
    progressGateway.addProgress('progress-last-map', ProgressSource.TASK, 500);

    expect(progressGateway.getGlobalState().mapIndex).toBe(4);
    const emitSpy = jest.spyOn(progressGateway.server, 'emit');

    // When: 마지막 맵에서 임계치 근접 상태에서 progress를 추가하면
    progressGateway.addProgress('progress-last-map', ProgressSource.TASK, 490);
    progressGateway.addProgress('progress-last-map', ProgressSource.TASK, 50);

    // Then: progress는 상한(500)으로 고정되고 추가 map_switch는 발생하지 않는다
    const state = progressGateway.getGlobalState();
    expect(state.mapIndex).toBe(4);
    expect(state.progress).toBe(500);
    const mapSwitchCalls = emitSpy.mock.calls.filter(
      (call) => call[0] === 'map_switch',
    );
    expect(mapSwitchCalls).toHaveLength(0);
    emitSpy.mockRestore();
  });

  it('season reset을 실행하면 상태가 초기화되고 season_reset 이벤트가 브로드캐스트된다', async () => {
    // Given: progress와 contributions가 누적된 상태
    const observer = await connectObserverSocket(
      51003,
      'progress-season-reset',
    );
    progressGateway.addProgress(
      'progress-season-reset',
      ProgressSource.TASK,
      42,
    );

    // When: 시즌 리셋을 실행하면
    const seasonResetPromise = waitForSocketEvent<{ mapIndex: number }>(
      observer,
      'season_reset',
    );
    await progressGateway.resetSeason();

    // Then: season_reset 이벤트가 전송되고 전역 상태가 초기화된다
    const seasonResetEvent = await seasonResetPromise;
    expect(seasonResetEvent.mapIndex).toBe(0);

    const state = progressGateway.getGlobalState();
    expect(state.progress).toBe(0);
    expect(state.mapIndex).toBe(0);
    expect(state.contributions).toEqual({});
  });

  it('파일 DB를 사용하면 앱 재기동 후 GlobalState가 복원된다', async () => {
    // Given: 파일 DB 기반 테스트 앱에서 progress 상태를 저장한 상태
    const dbPath = path.join(
      os.tmpdir(),
      `progress-season-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    );

    let firstApp: TestAppContext | null = null;
    let secondApp: TestAppContext | null = null;

    try {
      firstApp = await createTestApp({ database: dbPath, dropSchema: true });
      const firstGateway = firstApp.moduleRef.get(ProgressGateway);

      firstGateway.addProgress('persist-user', ProgressSource.TASK, 123);
      await delay(1200);

      expect(firstGateway.getGlobalState().progress).toBe(123);
      await firstApp.app.close();
      firstApp = null;

      // When: 같은 DB 파일로 앱을 다시 기동하면
      secondApp = await createTestApp({ database: dbPath, dropSchema: false });
      const restoredState = secondApp.moduleRef
        .get(ProgressGateway)
        .getGlobalState();

      // Then: 이전 GlobalState(progress/contributions/mapIndex)가 복원된다
      expect(restoredState.progress).toBe(123);
      expect(restoredState.mapIndex).toBe(0);
      expect(restoredState.contributions).toEqual({ 'persist-user': 123 });
    } finally {
      if (firstApp) {
        await firstApp.app.close();
      }
      if (secondApp) {
        await secondApp.app.close();
      }
      await fs.rm(dbPath, { force: true });
    }
  });
});
