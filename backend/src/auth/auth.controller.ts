import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { GithubGuard } from './github.guard';
import { JwtGuard } from './jwt.guard';
import { UserStore } from './user.store';
import { User } from './user.interface';
import type { UserInfo } from './user.interface';
import { getFrontendUrls } from '../config/frontend-urls';
import { PlayerService } from '../player/player.service';

interface TestLoginBody {
  socialId: number | string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
}

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private userStore: UserStore,
    private playerService: PlayerService,
  ) {}

  @Get('github')
  @UseGuards(GithubGuard)
  github() {
    // GithubGuard가 GitHub 로그인 페이지로 리다이렉트
  }

  @Get('github/callback')
  @UseGuards(GithubGuard)
  githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    this.logger.log('GitHub callback', {
      method: 'githubCallback',
      username: user.username,
    });

    this.logger.log('JWT token generated', {
      method: 'githubCallback',
      username: user.username,
    });

    this.setAccessTokenCookie(res, user);

    const frontendUrls = getFrontendUrls(this.configService);
    const frontendUrl = frontendUrls[0];
    this.logger.log('Redirecting to callback', {
      method: 'githubCallback',
      url: `${frontendUrl}/auth/callback`,
    });
    res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Post('test-login')
  @HttpCode(HttpStatus.OK)
  async testLogin(
    @Body() body: TestLoginBody,
    @Headers('x-e2e-secret') e2eSecret: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserInfo> {
    this.assertPlaywrightTestLoginEnabled(e2eSecret);

    const socialId = this.parseSocialId(body.socialId);
    const username = this.requireNonBlank(body.username, 'username');
    const nickname = this.normalizeOptional(body.nickname) ?? username;
    const avatarUrl =
      this.normalizeOptional(body.avatarUrl) ??
      `https://github.com/${username}.png`;

    const player = await this.playerService.findOrCreateBySocialId(
      socialId,
      nickname,
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
      method: 'testLogin',
      username: user.username,
      playerId: user.playerId,
    });

    return this.toUserInfo(user);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Req() req: Request) {
    const userInfo = this.toUserInfo(req.user as User);
    this.logger.log('GET /auth/me', {
      method: 'me',
      username: userInfo.username,
    });
    return userInfo;
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    const frontendUrls = getFrontendUrls(this.configService);
    res.redirect(frontendUrls[0]);
  }

  private setAccessTokenCookie(res: Response, user: User): void {
    const token = this.jwtService.sign({
      sub: user.githubId,
      username: user.username,
      playerId: user.playerId,
    });
    const cookieOptions = {
      httpOnly: true,
      secure: false, // HTTPS 사용 시 true로 변경
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

  private assertPlaywrightTestLoginEnabled(
    providedSecret: string | undefined,
  ): void {
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

  private toUserInfo(user: User): UserInfo {
    const { githubId, username, avatarUrl, playerId } = user;
    return { githubId, username, avatarUrl, playerId };
  }
}
