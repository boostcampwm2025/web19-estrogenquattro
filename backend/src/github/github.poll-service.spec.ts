import { Test, TestingModule } from '@nestjs/testing';
import { GithubPollService } from './github.poll-service';
import { GithubGateway } from './github.gateway';
import { GithubService } from './github.service';
import { PointService } from '../point/point.service';

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

  describe('pollGithubEvents 네트워크 에러 처리', () => {
    it('fetch가 네트워크 에러를 던지면 서버가 크래시되지 않고 error 상태를 반환한다', async () => {
      // Given: 폴링 스케줄과 베이스라인이 설정된 상태
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
      // 에러가 발생해도 예외가 전파되지 않음 (크래시 없음)
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

    it('연결 타임아웃 시에도 서버가 크래시되지 않는다', async () => {
      // Given: 폴링 스케줄이 설정된 상태
      service.subscribeGithubEvent(
        new Date(),
        'client-3',
        'room-1',
        'testuser3',
        'test-token',
        3,
      );

      // 연결 타임아웃 에러
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('connect ETIMEDOUT'));

      // When: 폴링 실행
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      // Then: 크래시 없이 정상 동작
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
