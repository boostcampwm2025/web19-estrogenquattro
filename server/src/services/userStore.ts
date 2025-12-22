import type { User } from './types.js';

class UserStore {
  private users = new Map<string, User>();

  findByGithubId(githubId: string): User | undefined {
    return this.users.get(githubId);
  }

  save(user: User): User {
    this.users.set(user.githubId, user);
    return user;
  }

  findOrCreate(user: User): User {
    const existingUser = this.findByGithubId(user.githubId);
    if (existingUser) {
      // 재로그인 시 accessToken 업데이트
      existingUser.accessToken = user.accessToken;
      return existingUser;
    }
    return this.save(user);
  }
}

// 싱글톤 인스턴스
export const userStore = new UserStore();
