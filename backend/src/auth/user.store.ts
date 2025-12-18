import { Injectable } from '@nestjs/common';
import { User } from './user.interface';

@Injectable()
export class UserStore {
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
      return existingUser;
    }
    return this.save(user);
  }
}
