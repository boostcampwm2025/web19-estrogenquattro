import { Injectable } from '@nestjs/common';
import { User } from './user.interface';

@Injectable()
export class UserStore {
  private users = new Map<string, User>();

  private hasNonBlank(value: string): boolean {
    return value.trim().length > 0;
  }

  findByGithubId(githubId: string): User | undefined {
    return this.users.get(githubId);
  }

  save(user: User): User {
    this.users.set(user.githubId, user);
    return user;
  }

  clear(): void {
    this.users.clear();
  }

  findOrCreate(user: User): User {
    const existingUser = this.findByGithubId(user.githubId);
    if (existingUser) {
      // 재로그인 시 accessToken 및 프로필 최신값 반영
      existingUser.accessToken = user.accessToken;
      existingUser.playerId = user.playerId;

      if (this.hasNonBlank(user.username)) {
        existingUser.username = user.username.trim();
      }

      if (this.hasNonBlank(user.avatarUrl)) {
        existingUser.avatarUrl = user.avatarUrl.trim();
      }

      return existingUser;
    }
    return this.save(user);
  }
}
