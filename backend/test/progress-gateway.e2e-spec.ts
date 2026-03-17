import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'socket.io';

import {
  GithubEventData,
  ProgressGateway,
  ProgressSource,
} from '../src/github/progress.gateway';
import { GlobalState } from '../src/github/entities/global-state.entity';

type PersistedGlobalState = {
  id: number;
  progress: number;
  contributions: string;
  mapIndex: number;
};

describe('ProgressGateway integration branches', () => {
  let module: TestingModule;
  let gateway: ProgressGateway;

  const mockRepository = {
    findOne: jest.fn<Promise<PersistedGlobalState | null>, [unknown]>(),
    save: jest.fn<Promise<PersistedGlobalState>, [PersistedGlobalState]>(),
  };

  const mockServer = {
    emit: jest.fn(),
  };

  const createGateway = async (savedState?: PersistedGlobalState | null) => {
    jest.clearAllMocks();

    mockRepository.findOne.mockResolvedValue(
      savedState === undefined
        ? {
            id: 1,
            progress: 0,
            contributions: '{}',
            mapIndex: 0,
          }
        : savedState,
    );
    mockRepository.save.mockImplementation(async (state) => state);

    module = await Test.createTestingModule({
      providers: [
        ProgressGateway,
        {
          provide: getRepositoryToken(GlobalState),
          useValue: mockRepository,
        },
      ],
    }).compile();

    gateway = module.get(ProgressGateway);
    (gateway as unknown as { server: Server }).server =
      mockServer as unknown as Server;
    await gateway.onModuleInit();
  };

  afterEach(async () => {
    jest.useRealTimers();
    if (module) {
      await module.close();
    }
  });

  it('저장된 상태가 없으면 기본 GlobalState 레코드를 생성한다', async () => {
    await createGateway(null);

    expect(mockRepository.save).toHaveBeenCalledWith({
      id: 1,
      progress: 0,
      contributions: '{}',
      mapIndex: 0,
    });
    expect(gateway.getGlobalState()).toMatchObject({
      progress: 0,
      mapIndex: 0,
      contributions: {},
    });
  });

  it('잘못된 contributions 또는 mapIndex는 기본 상태로 되돌린다', async () => {
    await createGateway({
      id: 1,
      progress: 99,
      contributions: '{"alice":"broken"}',
      mapIndex: 99,
    });

    expect(gateway.getGlobalState()).toMatchObject({
      progress: 0,
      mapIndex: 0,
      contributions: {},
    });
  });

  it('초기화 중 조회가 실패해도 기본 상태를 유지한다', async () => {
    jest.clearAllMocks();
    mockRepository.findOne.mockRejectedValueOnce(new Error('init failed'));
    mockRepository.save.mockImplementation(async (state) => state);

    module = await Test.createTestingModule({
      providers: [
        ProgressGateway,
        {
          provide: getRepositoryToken(GlobalState),
          useValue: mockRepository,
        },
      ],
    }).compile();

    gateway = module.get(ProgressGateway);
    (gateway as unknown as { server: Server }).server =
      mockServer as unknown as Server;

    await expect(gateway.onModuleInit()).resolves.toBeUndefined();
    expect(gateway.getGlobalState()).toMatchObject({
      progress: 0,
      mapIndex: 0,
      contributions: {},
    });
  });

  it('GitHub source로 addProgress를 호출하면 아무 작업도 하지 않는다', async () => {
    jest.useFakeTimers();
    await createGateway();

    gateway.addProgress('noop-user', ProgressSource.GITHUB, 3);
    jest.advanceTimersByTime(1000);

    expect(mockRepository.save).not.toHaveBeenCalled();
    expect(mockServer.emit).not.toHaveBeenCalled();
  });

  it('DB 저장이 실패해도 destroy flush는 예외를 삼키고 종료한다', async () => {
    jest.useFakeTimers();
    await createGateway();
    mockRepository.save.mockRejectedValueOnce(new Error('persist failed'));

    gateway.addProgress('persist-user', ProgressSource.TASK, 1);

    await expect(gateway.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('GitHub progress 업데이트로도 마지막 맵에서 progress가 상한값을 넘지 않는다', async () => {
    await createGateway({
      id: 1,
      progress: 490,
      contributions: '{}',
      mapIndex: 4,
    });

    const rawData: GithubEventData = {
      username: 'cap-user',
      commitCount: 20,
      prCount: 0,
      mergeCount: 0,
      issueCount: 0,
      reviewCount: 0,
    };

    gateway.castProgressUpdate('cap-user', ProgressSource.GITHUB, rawData);

    expect(gateway.getGlobalState()).toMatchObject({
      progress: 500,
      mapIndex: 4,
    });
    expect(mockServer.emit).toHaveBeenCalledWith(
      'progress_update',
      expect.objectContaining({
        targetProgress: 500,
        mapIndex: 4,
      }),
    );
  });

  it('GitHub progress 업데이트로 임계치를 넘기면 map_switch를 발생시킨다', async () => {
    await createGateway({
      id: 1,
      progress: 190,
      contributions: '{}',
      mapIndex: 0,
    });

    const rawData: GithubEventData = {
      username: 'switch-user',
      commitCount: 10,
      prCount: 0,
      mergeCount: 0,
      issueCount: 0,
      reviewCount: 0,
    };

    gateway.castProgressUpdate('switch-user', ProgressSource.GITHUB, rawData);

    expect(gateway.getMapIndex()).toBe(1);
    expect(mockServer.emit).toHaveBeenCalledWith('map_switch', { mapIndex: 1 });
    expect(mockServer.emit).toHaveBeenCalledWith(
      'progress_update',
      expect.objectContaining({
        targetProgress: 0,
        mapIndex: 1,
      }),
    );
  });
});
