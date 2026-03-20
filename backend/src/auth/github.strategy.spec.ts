import { ConfigService } from '@nestjs/config';
import { GithubStrategy } from './github.strategy';
import { UserStore } from './user.store';
import { PlayerService } from '../player/player.service';

describe('GithubStrategy', () => {
  const userStore = {
    findOrCreate: jest.fn(),
    save: jest.fn(),
  } as unknown as UserStore;

  const playerService = {
    findOrCreateBySocialId: jest.fn(),
  } as unknown as PlayerService;

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GITHUB_CLIENT_ID: 'client-id',
        GITHUB_CLIENT_SECRET: 'client-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
      };

      return config[key];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GitHub username을 player와 user store 양쪽에 동일하게 반영한다', async () => {
    const strategy = new GithubStrategy(
      userStore,
      playerService,
      configService,
    );
    const profile = {
      id: '12345',
      username: 'octocat',
      photos: [{ value: 'https://github.com/octocat.png' }],
    };

    (playerService.findOrCreateBySocialId as jest.Mock).mockResolvedValue({
      id: 7,
    });
    (userStore.findOrCreate as jest.Mock).mockReturnValue({
      githubId: '12345',
      username: 'octocat',
      avatarUrl: 'https://github.com/octocat.png',
      accessToken: 'token',
      playerId: 7,
    });
    (userStore.save as jest.Mock).mockImplementation((user) => user);

    const saved = await strategy.validate('token', 'refresh-token', profile);

    expect(playerService.findOrCreateBySocialId).toHaveBeenCalledWith(
      12345,
      'octocat',
      'octocat',
    );
    expect(userStore.findOrCreate).toHaveBeenCalledWith({
      githubId: '12345',
      username: 'octocat',
      avatarUrl: 'https://github.com/octocat.png',
      accessToken: 'token',
      playerId: 7,
    });
    expect(saved).toMatchObject({
      githubId: '12345',
      username: 'octocat',
      playerId: 7,
    });
  });
});
