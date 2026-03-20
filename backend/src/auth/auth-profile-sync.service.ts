import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from 'octokit';
import { PlayerService } from '../player/player.service';
import { User } from './user.interface';
import { UserStore } from './user.store';

@Injectable()
export class AuthProfileSyncService {
  private readonly logger = new Logger(AuthProfileSyncService.name);

  constructor(
    private readonly userStore: UserStore,
    private readonly playerService: PlayerService,
  ) {}

  async syncCurrentUser(user: User): Promise<User> {
    try {
      const octokit = new Octokit({ auth: user.accessToken });
      const { data } = await octokit.rest.users.getAuthenticated();

      const username = data.login?.trim();
      if (!username) {
        return user;
      }

      const player = await this.playerService.findOrCreateBySocialId(
        Number(user.githubId),
        username,
      );

      return this.userStore.findOrCreate({
        ...user,
        username,
        avatarUrl: data.avatar_url?.trim() || user.avatarUrl,
        playerId: player.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        'Failed to sync latest GitHub profile, using cached user',
        {
          method: 'syncCurrentUser',
          githubId: user.githubId,
          error: message,
        },
      );
      return user;
    }
  }
}
