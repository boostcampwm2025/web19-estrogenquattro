import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { UserStore } from './user.store';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor(
    private userStore: UserStore,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK_URL'),
    });
  }

  validate(accessToken: string, refreshToken: string, profile: Profile) {
    const username =
      (profile.username && profile.username.trim()) ||
      (profile.displayName && profile.displayName.trim()) ||
      `github-${profile.id}`;
    this.logger.log(
      `GitHub OAuth validated - username: ${username}`,
    );

    const user = this.userStore.findOrCreate({
      githubId: profile.id,
      username,
      avatarUrl: profile.photos?.[0]?.value || '',
    });

    this.logger.log(`User stored/found - username: ${user.username}`);
    return user;
  }
}
