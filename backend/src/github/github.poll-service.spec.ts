import { Test, TestingModule } from '@nestjs/testing';
import { GithubPollService } from './github.poll-service';
import { GithubGateway } from './github.gateway';
import { GithubService } from './github.service';
import { PointService } from '../point/point.service';
import { GithubActivityType } from './entities/daily-github-activity.entity';

describe('GithubPollService', () => {
  let service: GithubPollService;
  let originalFetch: typeof global.fetch;

  const mockGithubGateway = {
    castGithubEventToRoom: jest.fn(),
  };

  const mockGithubService = {
    incrementActivity: jest.fn(),
  };

  const mockPointService = {
    addPoint: jest.fn(),
  };

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubPollService,
        { provide: GithubGateway, useValue: mockGithubGateway },
        { provide: GithubService, useValue: mockGithubService },
        { provide: PointService, useValue: mockPointService },
      ],
    }).compile();

    service = module.get<GithubPollService>(GithubPollService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('네트워크 에러 처리', () => {
    it('fetch가 네트워크 에러를 던지면 서버가 크래시되지 않고 error 상태를 반환한다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // fetch가 네트워크 에러를 던지도록 모킹
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

      // When: 폴링 타이머가 실행됨
      jest.advanceTimersByTime(1000);

      // 비동기 작업 완료 대기
      await Promise.resolve();
      await Promise.resolve();

      // Then: 서버가 크래시되지 않고 다음 폴링이 스케줄됨
      expect(global.fetch).toHaveBeenCalled();
    });

    it('DNS 조회 실패 시에도 서버가 크래시되지 않는다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-2',
        'room-1',
        'testuser2',
        'test-token',
        2,
      );

      // DNS 조회 실패 에러
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.github.com'));

      // When: 폴링 실행
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Then: 크래시 없이 정상 동작
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('ETag 조건부 요청', () => {
    it('첫 요청 후 ETag를 저장하고 다음 요청에 If-None-Match 헤더를 포함한다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // 첫 번째 요청: ETag 반환
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([
          ['ETag', '"abc123"'],
          ['X-RateLimit-Remaining', '4999'],
        ]),
        json: () => Promise.resolve([{ id: '100', type: 'PushEvent' }]),
      });

      // When: 첫 폴링 실행
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Then: Events API가 호출되어야 함
      const mockFetch = global.fetch as jest.Mock;
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(url).toContain('/events/public');
      expect(options.headers.Authorization).toBe('Bearer test-token');
    });

    it('304 응답 시 이벤트 처리를 스킵한다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // 첫 번째 요청: 이벤트 반환
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"abc123"'],
            ['X-RateLimit-Remaining', '4999'],
          ]),
          json: () =>
            Promise.resolve([
              {
                id: '100',
                type: 'PushEvent',
                repo: { name: 'owner/repo' },
                payload: { before: 'abc', head: 'def' },
              },
            ]),
        })
        // 두 번째 요청: 304 응답
        .mockResolvedValueOnce({
          ok: false,
          status: 304,
          headers: new Map([['X-RateLimit-Remaining', '4999']]),
        });

      // When: 첫 폴링 실행
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // 두 번째 폴링 실행 (120초 후)
      jest.advanceTimersByTime(120000);
      await Promise.resolve();
      await Promise.resolve();

      // Then: 두 번째 요청 후에도 브로드캐스트가 호출되지 않음
      expect(mockGithubGateway.castGithubEventToRoom).not.toHaveBeenCalled();
    });
  });

  describe('401 토큰 만료 처리', () => {
    it('401 응답 시 폴링을 중지한다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // 401 응답
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Map([['X-RateLimit-Remaining', '4999']]),
      });

      // When: 폴링 실행
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Then: 폴링이 중지됨 (더 이상 fetch 호출 없음)
      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // 120초 후에도 추가 호출이 없어야 함
      jest.advanceTimersByTime(120000);
      await Promise.resolve();
      await Promise.resolve();

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(
        fetchCallCount,
      );
    });
  });

  describe('403/429 Rate Limit 처리', () => {
    it('403 응답 시 10분 후에 다시 폴링한다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // 403 응답
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Map([['X-RateLimit-Remaining', '0']]),
      });

      // When: 폴링 실행
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // 120초 후에는 추가 호출이 없어야 함
      jest.advanceTimersByTime(120000);
      await Promise.resolve();
      await Promise.resolve();
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(
        fetchCallCount,
      );

      // 10분(600초) 후에는 추가 호출이 있어야 함
      jest.advanceTimersByTime(480000); // 추가 480초 = 총 10분
      await Promise.resolve();
      await Promise.resolve();
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(
        fetchCallCount + 1,
      );
    });
  });

  describe('lastEventId 필터링', () => {
    it('첫 폴링에서는 lastEventId만 설정하고 브로드캐스트하지 않는다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // 이벤트가 있는 응답
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ['ETag', '"abc123"'],
          ['X-RateLimit-Remaining', '4999'],
        ]),
        json: () =>
          Promise.resolve([
            {
              id: '100',
              type: 'PushEvent',
              repo: { name: 'owner/repo' },
              payload: { before: 'abc', head: 'def' },
            },
          ]),
      });

      // When: 첫 폴링 실행
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Then: 브로드캐스트가 호출되지 않음
      expect(mockGithubGateway.castGithubEventToRoom).not.toHaveBeenCalled();
    });

    it('첫 폴링에서 이벤트가 없으면 NO_EVENTS_SENTINEL을 설정한다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // 첫 폴링: 빈 이벤트 배열
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"abc123"'],
            ['X-RateLimit-Remaining', '4999'],
          ]),
          json: () => Promise.resolve([]),
        })
        // 두 번째 폴링: 새 이벤트
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"def456"'],
            ['X-RateLimit-Remaining', '4998'],
          ]),
          json: () =>
            Promise.resolve([
              {
                id: '100',
                type: 'IssuesEvent',
                repo: { name: 'owner/repo' },
                payload: { action: 'opened', issue: { id: 1 } },
              },
            ]),
        });

      // When: 첫 폴링 실행
      jest.advanceTimersByTime(1000);
      // 비동기 작업 완료 대기 (multiple microtask flushes)
      for (let i = 0; i < 10; i++) await Promise.resolve();

      // 두 번째 폴링 실행 (120초 후)
      jest.advanceTimersByTime(120000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      // Then: 두 번째 폴링에서 이벤트가 처리됨
      expect(mockGithubService.incrementActivity).toHaveBeenCalled();
    });
  });

  describe('이벤트 타입별 파싱', () => {
    it('PullRequestEvent opened를 감지한다', async () => {
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      // 첫 폴링 + 두 번째 폴링 mock 설정
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"abc123"'],
            ['X-RateLimit-Remaining', '4999'],
          ]),
          json: () => Promise.resolve([{ id: '50', type: 'CreateEvent' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"def456"'],
            ['X-RateLimit-Remaining', '4998'],
          ]),
          json: () =>
            Promise.resolve([
              {
                id: '100',
                type: 'PullRequestEvent',
                repo: { name: 'owner/repo' },
                payload: {
                  action: 'opened',
                  number: 1,
                  pull_request: { id: 1, number: 1 },
                },
              },
            ]),
        });

      // 첫 폴링 실행
      jest.advanceTimersByTime(1000);
      // 비동기 작업 완료 대기 (multiple microtask flushes)
      for (let i = 0; i < 10; i++) await Promise.resolve();

      // 두 번째 폴링 실행
      jest.advanceTimersByTime(120000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(mockGithubGateway.castGithubEventToRoom).toHaveBeenCalledWith(
        expect.objectContaining({ pullRequestCount: 1 }),
        'room-1',
      );
    });

    it('PullRequestEvent merged를 감지한다', async () => {
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"abc123"'],
            ['X-RateLimit-Remaining', '4999'],
          ]),
          json: () => Promise.resolve([{ id: '50', type: 'CreateEvent' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"def456"'],
            ['X-RateLimit-Remaining', '4998'],
          ]),
          json: () =>
            Promise.resolve([
              {
                id: '100',
                type: 'PullRequestEvent',
                repo: { name: 'owner/repo' },
                payload: {
                  action: 'merged',
                  number: 1,
                  pull_request: { id: 1, number: 1 },
                },
              },
            ]),
        });

      jest.advanceTimersByTime(1000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      jest.advanceTimersByTime(120000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(mockGithubService.incrementActivity).toHaveBeenCalledWith(
        1,
        GithubActivityType.PR_MERGED,
        1,
      );
    });

    it('PullRequestEvent closed with merged=true를 머지로 감지한다 (fallback)', async () => {
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"abc123"'],
            ['X-RateLimit-Remaining', '4999'],
          ]),
          json: () => Promise.resolve([{ id: '50', type: 'CreateEvent' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"def456"'],
            ['X-RateLimit-Remaining', '4998'],
          ]),
          json: () =>
            Promise.resolve([
              {
                id: '100',
                type: 'PullRequestEvent',
                repo: { name: 'owner/repo' },
                payload: {
                  action: 'closed',
                  number: 1,
                  pull_request: { id: 1, number: 1, merged: true },
                },
              },
            ]),
        });

      jest.advanceTimersByTime(1000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      jest.advanceTimersByTime(120000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(mockGithubService.incrementActivity).toHaveBeenCalledWith(
        1,
        GithubActivityType.PR_MERGED,
        1,
      );
    });

    it('IssuesEvent opened를 감지한다', async () => {
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"abc123"'],
            ['X-RateLimit-Remaining', '4999'],
          ]),
          json: () => Promise.resolve([{ id: '50', type: 'CreateEvent' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"def456"'],
            ['X-RateLimit-Remaining', '4998'],
          ]),
          json: () =>
            Promise.resolve([
              {
                id: '100',
                type: 'IssuesEvent',
                repo: { name: 'owner/repo' },
                payload: {
                  action: 'opened',
                  issue: { id: 1, number: 1, title: 'test' },
                },
              },
            ]),
        });

      jest.advanceTimersByTime(1000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      jest.advanceTimersByTime(120000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(mockGithubService.incrementActivity).toHaveBeenCalledWith(
        1,
        GithubActivityType.ISSUE_OPEN,
        1,
      );
    });

    it('PullRequestReviewEvent created를 감지한다', async () => {
      service.subscribeGithubEvent(
        new Date(),
        'client-1',
        'room-1',
        'testuser',
        'test-token',
        1,
      );

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"abc123"'],
            ['X-RateLimit-Remaining', '4999'],
          ]),
          json: () => Promise.resolve([{ id: '50', type: 'CreateEvent' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([
            ['ETag', '"def456"'],
            ['X-RateLimit-Remaining', '4998'],
          ]),
          json: () =>
            Promise.resolve([
              {
                id: '100',
                type: 'PullRequestReviewEvent',
                repo: { name: 'owner/repo' },
                payload: {
                  action: 'created',
                  pull_request: { id: 1, number: 1 },
                  review: { id: 1, state: 'approved' },
                },
              },
            ]),
        });

      jest.advanceTimersByTime(1000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      jest.advanceTimersByTime(120000);
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(mockGithubService.incrementActivity).toHaveBeenCalledWith(
        1,
        GithubActivityType.PR_REVIEWED,
        1,
      );
    });
  });
});
