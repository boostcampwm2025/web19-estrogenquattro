import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { PlayerService } from '../player/player.service';
import { UserInfo, User } from './user.interface';
import { UserStore } from './user.store';

export interface PlaywrightTestLoginBody {
  socialId: number | string;
  username: string;
  avatarUrl?: string;
}

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userStore: UserStore,
    private readonly playerService: PlayerService,
  ) {}

  setAccessTokenCookie(res: Response, user: User): void {
    const token = this.jwtService.sign({
      sub: user.githubId,
      username: user.username,
      playerId: user.playerId,
    });
    const cookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    };

    this.logger.log('Setting cookie', {
      method: 'setAccessTokenCookie',
      options: cookieOptions,
    });
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, token, cookieOptions);
  }

  toUserInfo(user: User): UserInfo {
    const { githubId, username, avatarUrl, playerId } = user;
    return { githubId, username, avatarUrl, playerId };
  }

  async seedPlaywrightSession(
    body: PlaywrightTestLoginBody,
    e2eSecret: string | undefined,
    res: Response,
  ): Promise<UserInfo> {
    this.assertPlaywrightAuthEnabled(e2eSecret);

    const socialId = this.parseSocialId(body.socialId);
    const username = this.requireNonBlank(body.username, 'username');
    const avatarUrl =
      this.normalizeOptional(body.avatarUrl) ??
      `https://github.com/${username}.png`;

    const player = await this.playerService.findOrCreateBySocialId(
      socialId,
      username,
    );
    const user = this.userStore.findOrCreate({
      githubId: String(socialId),
      username,
      avatarUrl,
      accessToken: `playwright-test-access-token-${socialId}`,
      playerId: player.id,
    });

    this.setAccessTokenCookie(res, user);
    this.logger.log('Playwright test session seeded', {
      method: 'seedPlaywrightSession',
      username: user.username,
      playerId: user.playerId,
    });

    return this.toUserInfo(user);
  }

  private assertPlaywrightAuthEnabled(
    providedSecret: string | undefined,
  ): void {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'production') {
      throw new NotFoundException();
    }

    const isEnabled =
      this.configService.get<string>('PLAYWRIGHT_TEST_MODE') === 'true';
    if (!isEnabled) {
      throw new NotFoundException();
    }

    const expectedSecret = this.configService.getOrThrow<string>(
      'PLAYWRIGHT_E2E_SECRET',
    );
    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new ForbiddenException('Invalid x-e2e-secret');
    }
  }

  private parseSocialId(value: number | string): number {
    const socialId =
      typeof value === 'string'
        ? Number(value)
        : Number.isInteger(value)
          ? value
          : Number.NaN;

    if (!Number.isSafeInteger(socialId) || socialId <= 0) {
      throw new BadRequestException('socialId must be a positive integer');
    }

    return socialId;
  }

  private requireNonBlank(value: string, fieldName: string): string {
    const trimmed = this.normalizeOptional(value);
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} must be a non-empty string`);
    }
    return trimmed;
  }

  private normalizeOptional(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
