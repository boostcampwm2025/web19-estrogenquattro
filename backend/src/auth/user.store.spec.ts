import { UserStore } from './user.store';
import { User } from './user.interface';

describe('UserStore', () => {
  let store: UserStore;

  const baseUser: User = {
    githubId: '1001',
    username: 'octocat',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1001?v=4',
    accessToken: 'token-old',
    playerId: 7,
  };

  beforeEach(() => {
    store = new UserStore();
  });

  it('새 사용자를 저장한다', () => {
    // When
    const saved = store.findOrCreate({ ...baseUser });

    // Then
    expect(saved).toEqual(baseUser);
    expect(store.findByGithubId(baseUser.githubId)).toEqual(baseUser);
  });

  it('기존 사용자 재로그인 시 accessToken, username, avatarUrl을 최신값으로 갱신한다', () => {
    // Given
    store.save({ ...baseUser });

    // When
    const updated = store.findOrCreate({
      ...baseUser,
      username: '  octocat-renamed  ',
      avatarUrl: ' https://avatars.githubusercontent.com/u/1001-renamed?v=4 ',
      accessToken: 'token-new',
      playerId: 9,
    });

    // Then
    expect(updated.accessToken).toBe('token-new');
    expect(updated.username).toBe('octocat-renamed');
    expect(updated.avatarUrl).toBe(
      'https://avatars.githubusercontent.com/u/1001-renamed?v=4',
    );
    expect(updated.playerId).toBe(9);
  });

  it('기존 사용자 재로그인 시 비정상 username/avatarUrl은 기존 값을 유지한다', () => {
    // Given
    store.save({ ...baseUser });

    // When
    const updated = store.findOrCreate({
      ...baseUser,
      username: '   ',
      avatarUrl: '',
      accessToken: 'token-updated',
    });

    // Then
    expect(updated.username).toBe(baseUser.username);
    expect(updated.avatarUrl).toBe(baseUser.avatarUrl);
    expect(updated.accessToken).toBe('token-updated');
  });
});
