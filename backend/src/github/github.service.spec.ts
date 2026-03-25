/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { GithubService } from './github.service';
import {
  DailyGithubActivity,
  GithubActivityType,
} from './entities/daily-github-activity.entity';

const octokitState = {
  getByUsername: jest.fn(),
  request: jest.fn(),
  follow: jest.fn(),
  unfollow: jest.fn(),
};

jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      users: {
        getByUsername: octokitState.getByUsername,
        follow: octokitState.follow,
        unfollow: octokitState.unfollow,
      },
    },
    request: octokitState.request,
  })),
}));

describe('GithubService', () => {
  const createService = () => {
    const dailyGithubActivityRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as Repository<DailyGithubActivity>;

    return {
      service: new GithubService(dailyGithubActivityRepository),
      dailyGithubActivityRepository,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('기존 활동이 있으면 count를 누적 저장한다', async () => {
    const { service, dailyGithubActivityRepository } = createService();
    const existing = { count: 2 };
    (dailyGithubActivityRepository.findOne as jest.Mock).mockResolvedValue(
      existing,
    );

    await service.incrementActivity(1, GithubActivityType.PR_OPEN, 3);

    expect(existing.count).toBe(5);
    expect(dailyGithubActivityRepository.save).toHaveBeenCalledWith(existing);
  });

  it('기존 활동이 없으면 새 엔티티를 생성한다', async () => {
    const { service, dailyGithubActivityRepository } = createService();
    const created = { count: 1 };
    (dailyGithubActivityRepository.findOne as jest.Mock).mockResolvedValue(
      null,
    );
    (dailyGithubActivityRepository.create as jest.Mock).mockReturnValue(
      created,
    );

    await service.incrementActivity(1, GithubActivityType.COMMITTED, 1);

    expect(dailyGithubActivityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        player: { id: 1 },
        type: GithubActivityType.COMMITTED,
        count: 1,
      }),
    );
    expect(dailyGithubActivityRepository.save).toHaveBeenCalledWith(created);
  });

  it('기간 내 활동을 타입별로 합산한다', async () => {
    const { service, dailyGithubActivityRepository } = createService();
    (dailyGithubActivityRepository.find as jest.Mock).mockResolvedValue([
      { type: GithubActivityType.PR_OPEN, count: 2 },
      { type: GithubActivityType.PR_REVIEWED, count: 1 },
      { type: GithubActivityType.COMMITTED, count: 4 },
      { type: GithubActivityType.ISSUE_OPEN, count: 3 },
    ]);

    const startAt = new Date('2026-03-01T00:00:00.000Z');
    const endAt = new Date('2026-03-02T00:00:00.000Z');
    const result = await service.getPlayerActivities(1, startAt, endAt);

    expect(result).toEqual({
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      prCreated: 2,
      prReviewed: 1,
      committed: 4,
      issueOpened: 3,
    });
  });

  it('GitHub 사용자 조회 결과를 필요한 필드만 반환한다', async () => {
    const { service } = createService();
    octokitState.getByUsername.mockResolvedValue({
      data: {
        login: 'alice',
        id: 1,
        avatar_url: 'avatar',
        html_url: 'profile',
        followers: 10,
        following: 5,
        name: 'Alice',
        bio: 'bio',
      },
    });

    await expect(service.getUser('token', 'alice')).resolves.toEqual({
      login: 'alice',
      id: 1,
      avatar_url: 'avatar',
      html_url: 'profile',
      followers: 10,
      following: 5,
      name: 'Alice',
      bio: 'bio',
    });
  });

  it('팔로우 상태 조회에서 404는 false로 처리한다', async () => {
    const { service } = createService();
    octokitState.request.mockRejectedValue({ status: 404 });

    await expect(service.checkFollowStatus('token', 'alice')).resolves.toEqual({
      isFollowing: false,
    });
  });

  it('팔로우/언팔로우 요청 결과를 반환한다', async () => {
    const { service } = createService();
    octokitState.request.mockResolvedValue({ status: 204 });

    await expect(service.checkFollowStatus('token', 'alice')).resolves.toEqual({
      isFollowing: true,
    });

    await expect(service.followUser('token', 'alice')).resolves.toEqual({
      success: true,
    });
    await expect(service.unfollowUser('token', 'alice')).resolves.toEqual({
      success: true,
    });
  });
});
