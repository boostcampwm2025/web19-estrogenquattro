import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'socket.io';
import {
  ProgressGateway,
  ProgressSource,
  GithubEventData,
} from './progress.gateway';
import { GlobalState } from './entities/global-state.entity';
import { ACTIVITY_POINT_MAP } from '../point/point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';

describe('ProgressGateway', () => {
  let gateway: ProgressGateway;

  const mockGlobalStateRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockServer = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockGlobalStateRepository.findOne.mockResolvedValue({
      id: 1,
      progress: 0,
      contributions: '{}',
      mapIndex: 0,
    });
    mockGlobalStateRepository.save.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressGateway,
        {
          provide: getRepositoryToken(GlobalState),
          useValue: mockGlobalStateRepository,
        },
      ],
    }).compile();

    gateway = module.get<ProgressGateway>(ProgressGateway);
    (gateway as unknown as { server: Server }).server =
      mockServer as unknown as Server;
    await gateway.onModuleInit();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('castProgressUpdate', () => {
    it('GitHub 커밋 1개 시 contributions에 COMMITTED 포인트가 누적된다', () => {
      // Given: 초기 상태
      const rawData: GithubEventData = {
        username: 'testuser',
        commitCount: 1,
        prCount: 0,
        mergeCount: 0,
        issueCount: 0,
        reviewCount: 0,
      };

      // When: castProgressUpdate 호출
      gateway.castProgressUpdate('testuser', ProgressSource.GITHUB, rawData);

      // debounce 타이머 실행
      jest.advanceTimersByTime(1000);

      // Then: contributions에 포인트가 누적됨
      const state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(
        ACTIVITY_POINT_MAP[PointType.COMMITTED],
      );
    });

    it('GitHub PR 머지 1개 시 contributions에 PR_MERGED 포인트가 누적된다', () => {
      // Given: 초기 상태
      const rawData: GithubEventData = {
        username: 'testuser',
        commitCount: 0,
        prCount: 0,
        mergeCount: 1,
        issueCount: 0,
        reviewCount: 0,
      };

      // When
      gateway.castProgressUpdate('testuser', ProgressSource.GITHUB, rawData);
      jest.advanceTimersByTime(1000);

      // Then
      const state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(
        ACTIVITY_POINT_MAP[PointType.PR_MERGED],
      );
    });

    it('GitHub 커밋 2개 + PR 머지 1개 시 contributions에 복합 포인트가 누적된다', () => {
      // Given
      const rawData: GithubEventData = {
        username: 'testuser',
        commitCount: 2,
        prCount: 0,
        mergeCount: 1,
        issueCount: 0,
        reviewCount: 0,
      };

      // When
      gateway.castProgressUpdate('testuser', ProgressSource.GITHUB, rawData);
      jest.advanceTimersByTime(1000);

      // Then
      const expectedPoints =
        ACTIVITY_POINT_MAP[PointType.COMMITTED] * 2 +
        ACTIVITY_POINT_MAP[PointType.PR_MERGED] * 1;
      const state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(expectedPoints);
    });

    it('여러 활동 유형(커밋, PR 생성, 이슈, 리뷰)이 모두 포인트로 누적된다', () => {
      // Given
      const rawData: GithubEventData = {
        username: 'testuser',
        commitCount: 3,
        prCount: 1,
        mergeCount: 0,
        issueCount: 2,
        reviewCount: 1,
      };

      // When
      gateway.castProgressUpdate('testuser', ProgressSource.GITHUB, rawData);
      jest.advanceTimersByTime(1000);

      // Then
      const expectedPoints =
        ACTIVITY_POINT_MAP[PointType.COMMITTED] * 3 +
        ACTIVITY_POINT_MAP[PointType.PR_OPEN] * 1 +
        ACTIVITY_POINT_MAP[PointType.ISSUE_OPEN] * 2 +
        ACTIVITY_POINT_MAP[PointType.PR_REVIEWED] * 1;
      const state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(expectedPoints);
    });

    it('progress_update 이벤트에 포인트 기준 contributions가 포함된다', () => {
      // Given
      const rawData: GithubEventData = {
        username: 'testuser',
        commitCount: 1,
        prCount: 0,
        mergeCount: 0,
        issueCount: 0,
        reviewCount: 0,
      };

      // When
      gateway.castProgressUpdate('testuser', ProgressSource.GITHUB, rawData);

      // Then
      expect(mockServer.emit).toHaveBeenCalledWith(
        'progress_update',
        expect.objectContaining({
          contributions: {
            testuser: ACTIVITY_POINT_MAP[PointType.COMMITTED],
          },
        }),
      );
    });
  });

  describe('addProgress', () => {
    it('Task 완료 1개 시 contributions에 TASK_COMPLETED 포인트가 누적된다', () => {
      // Given: 초기 상태

      // When
      gateway.addProgress('testuser', ProgressSource.TASK, 1);
      jest.advanceTimersByTime(1000);

      // Then
      const state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(
        ACTIVITY_POINT_MAP[PointType.TASK_COMPLETED],
      );
    });

    it('Focus 30분 1회 시 contributions에 FOCUSED 포인트가 누적된다', () => {
      // Given: 초기 상태

      // When
      gateway.addProgress('testuser', ProgressSource.FOCUSTIME, 1);
      jest.advanceTimersByTime(1000);

      // Then
      const state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(
        ACTIVITY_POINT_MAP[PointType.FOCUSED],
      );
    });

    it('Task 완료 3개 시 contributions에 TASK_COMPLETED × 3 포인트가 누적된다', () => {
      // Given: 초기 상태

      // When
      gateway.addProgress('testuser', ProgressSource.TASK, 3);
      jest.advanceTimersByTime(1000);

      // Then
      const state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(
        ACTIVITY_POINT_MAP[PointType.TASK_COMPLETED] * 3,
      );
    });

    it('progress_update 이벤트에 포인트 기준 contributions가 포함된다', () => {
      // Given: 초기 상태

      // When
      gateway.addProgress('testuser', ProgressSource.TASK, 2);

      // Then
      expect(mockServer.emit).toHaveBeenCalledWith(
        'progress_update',
        expect.objectContaining({
          contributions: {
            testuser: ACTIVITY_POINT_MAP[PointType.TASK_COMPLETED] * 2,
          },
        }),
      );
    });
  });

  describe('영속성/복원', () => {
    it('저장된 contributions 포인트가 복원 후에도 유지된다', () => {
      // Given: contributions에 포인트 누적
      gateway.addProgress('testuser', ProgressSource.TASK, 2);
      jest.advanceTimersByTime(1000);

      // persistState 호출 확인
      expect(mockGlobalStateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contributions: JSON.stringify({
            testuser: ACTIVITY_POINT_MAP[PointType.TASK_COMPLETED] * 2,
          }),
        }),
      );
    });

    it('복원 시 contributions가 포인트 값으로 설정된다', async () => {
      // Given: DB에 포인트 기반 contributions 저장
      mockGlobalStateRepository.findOne.mockResolvedValue({
        id: 1,
        progress: 10,
        contributions: JSON.stringify({ testuser: 20 }),
        mapIndex: 0,
      });

      // When: 새 gateway 인스턴스 생성 및 초기화
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProgressGateway,
          {
            provide: getRepositoryToken(GlobalState),
            useValue: mockGlobalStateRepository,
          },
        ],
      }).compile();

      const newGateway = module.get<ProgressGateway>(ProgressGateway);
      await newGateway.onModuleInit();

      // Then: 복원된 contributions 값 확인
      const state = newGateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(20);
    });
  });

  describe('시즌 리셋', () => {
    it('시즌 리셋 후 새 활동 시 contributions에 포인트가 누적된다', async () => {
      // Given: 기존 contributions 존재
      gateway.addProgress('testuser', ProgressSource.TASK, 5);
      jest.advanceTimersByTime(1000);

      (gateway as unknown as { server: Server }).server =
        mockServer as unknown as Server;

      // When: 시즌 리셋
      await gateway.resetSeason();

      // contributions가 초기화됨
      let state = gateway.getGlobalState();
      expect(state.contributions).toEqual({});

      // 새 활동 추가
      gateway.addProgress('testuser', ProgressSource.TASK, 1);
      jest.advanceTimersByTime(1000);

      // Then: 새 포인트가 누적됨
      state = gateway.getGlobalState();
      expect(state.contributions['testuser']).toBe(
        ACTIVITY_POINT_MAP[PointType.TASK_COMPLETED],
      );
    });
  });

  describe('game_state', () => {
    it('game_state에 포인트 기준 contributions가 포함된다', () => {
      // Given: contributions에 포인트 누적
      const rawData: GithubEventData = {
        username: 'testuser',
        commitCount: 1,
        prCount: 0,
        mergeCount: 0,
        issueCount: 0,
        reviewCount: 0,
      };
      gateway.castProgressUpdate('testuser', ProgressSource.GITHUB, rawData);

      // When
      const state = gateway.getGlobalState();

      // Then
      expect(state.contributions['testuser']).toBe(
        ACTIVITY_POINT_MAP[PointType.COMMITTED],
      );
    });
  });
});
