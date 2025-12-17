import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { GithubGuard } from './github.guard';
import { JwtGuard } from './jwt.guard';
import { User } from './user.interface';

@Controller('auth')
export class AuthController {
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
  githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;

    const token = this.jwtService.sign({
      sub: user.githubId,
      username: user.username,
    });

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1일
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
    res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Req() req: Request) {
    return req.user;
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.redirect(this.configService.get<string>('FRONTEND_URL')!);
  }
}
