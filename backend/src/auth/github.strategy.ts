import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { UserStore } from './user.store';
import { PlayerService } from '../player/player.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor(
    private userStore: UserStore,
    private playerService: PlayerService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK_URL'),
      scope: ['read:user', 'user:follow'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    const username =
      (profile.username && profile.username.trim()) ||
      (profile.displayName && profile.displayName.trim()) ||
      `github-${profile.id}`;
    this.logger.log('GitHub OAuth validated', { method: 'validate', username });

    const player = await this.playerService.findOrCreateBySocialId(
      Number(profile.id),
      username,
    );

    const user = this.userStore.findOrCreate({
      githubId: profile.id,
      username,
      avatarUrl: profile.photos?.[0]?.value || '',
      accessToken,
      playerId: player.id,
    });

    const saved = this.userStore.save({ ...user, playerId: player.id });
    this.logger.log('User stored/found', {
      method: 'validate',
      username: saved.username,
      playerId: saved.playerId,
    });
    return saved;
  }
}
