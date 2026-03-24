import { Controller, Get, Logger, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { GithubGuard } from './github.guard';
import { JwtGuard } from './jwt.guard';
import { User } from './user.interface';
import { AuthProfileSyncService } from './auth-profile-sync.service';
import { getFrontendUrls } from '../config/frontend-urls';
import { AdminService } from '../admin/admin.service';
import { AuthSessionService } from './auth-session.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly adminService: AdminService,
    private readonly authSessionService: AuthSessionService,
    private readonly authProfileSyncService: AuthProfileSyncService,
  ) {}

  @Get('github')
  @UseGuards(GithubGuard)
  github() {
    // GithubGuard가 GitHub 로그인 페이지로 리다이렉트
  }

  @Get('github/callback')
  @UseGuards(GithubGuard)
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;

    // 밴 여부 확인
    const { isBanned, reason } = await this.adminService.getBan(user.playerId);
    if (isBanned) {
      const frontendUrls = getFrontendUrls(this.configService);
      const params = new URLSearchParams({ banned: 'true' });
      if (reason) params.set('reason', reason);
      return res.redirect(`${frontendUrls[0]}/login?${params.toString()}`);
    }

    this.logger.log('GitHub callback', {
      method: 'githubCallback',
      username: user.username,
    });

    this.logger.log('JWT token generated', {
      method: 'githubCallback',
      username: user.username,
    });

    this.authSessionService.setAccessTokenCookie(res, user);

    const frontendUrls = getFrontendUrls(this.configService);
    const frontendUrl = frontendUrls[0];
    this.logger.log('Redirecting to callback', {
      method: 'githubCallback',
      url: `${frontendUrl}/auth/callback`,
    });
    res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@Req() req: Request) {
    const syncedUser = await this.authProfileSyncService.syncCurrentUser(
      req.user as User,
    );
    const userInfo = this.authSessionService.toUserInfo(syncedUser);
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
}
