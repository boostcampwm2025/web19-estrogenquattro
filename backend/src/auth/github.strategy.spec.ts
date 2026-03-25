import { ConfigService } from '@nestjs/config';
import { GithubStrategy } from './github.strategy';
import { UserStore } from './user.store';
import { User } from './user.interface';
import { PlayerService } from '../player/player.service';

describe('GithubStrategy', () => {
  const findOrCreateUserMock = jest.fn();
  const saveUserMock = jest.fn((user: User) => user);
  const userStore = {
    findOrCreate: findOrCreateUserMock,
    save: saveUserMock,
  } as unknown as UserStore;

  const findOrCreatePlayerMock = jest.fn();
  const playerService = {
    findOrCreateBySocialId: findOrCreatePlayerMock,
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

  it('GitHub username을 player nickname과 user store 양쪽에 동일하게 반영한다', async () => {
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

    findOrCreatePlayerMock.mockResolvedValue({
      id: 7,
    });
    findOrCreateUserMock.mockReturnValue({
      githubId: '12345',
      username: 'octocat',
      avatarUrl: 'https://github.com/octocat.png',
      accessToken: 'token',
      playerId: 7,
    });

    const saved = await strategy.validate('token', 'refresh-token', profile);

    expect(findOrCreatePlayerMock).toHaveBeenCalledWith(12345, 'octocat');
    expect(findOrCreateUserMock).toHaveBeenCalledWith({
      githubId: '12345',
      username: 'octocat',
      avatarUrl: 'https://github.com/octocat.png',
      accessToken: 'token',
      playerId: 7,
    });
    expect(saveUserMock).toHaveBeenCalledWith({
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
