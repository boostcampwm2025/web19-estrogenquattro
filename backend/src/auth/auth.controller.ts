import { Controller, Get, Logger, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { GithubGuard } from './github.guard';
import { JwtGuard } from './jwt.guard';
import { User } from './user.interface';
import type { UserInfo } from './user.interface';
import { getFrontendUrls } from '../config/frontend-urls';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
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
    this.logger.log(`GitHub callback - username: ${user.username}`);

    const token = this.jwtService.sign({
      sub: user.githubId,
      username: user.username,
      playerId: user.playerId,
    });
    this.logger.log(`JWT token generated for user: ${user.username}`);

    const cookieOptions = {
      httpOnly: true,
      secure: false, // HTTPS 사용 시 true로 변경
      sameSite: 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000, // 1일
      path: '/',
    };
    this.logger.log(
      `Setting cookie with options: ${JSON.stringify(cookieOptions)}`,
    );

    res.cookie('access_token', token, cookieOptions);

    const frontendUrls = getFrontendUrls(this.configService);
    const frontendUrl = frontendUrls[0];
    this.logger.log(`Redirecting to: ${frontendUrl}/auth/callback`);
    res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Req() req: Request) {
    const { githubId, username, avatarUrl, playerId } = req.user as User;
    const userInfo: UserInfo = { githubId, username, avatarUrl, playerId };
    this.logger.log(`/me called - username: ${userInfo.username}`);
    return userInfo;
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    const frontendUrls = getFrontendUrls(this.configService);
    res.redirect(frontendUrls[0]);
  }
}
