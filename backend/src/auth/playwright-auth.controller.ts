import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthSessionService,
} from './auth-session.service';
import type { PlaywrightTestLoginBody } from './auth-session.service';
import type { UserInfo } from './user.interface';

@Controller('auth')
export class PlaywrightAuthController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  @Post('test-login')
  @HttpCode(HttpStatus.OK)
  testLogin(
    @Body() body: PlaywrightTestLoginBody,
    @Headers('x-e2e-secret') e2eSecret: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserInfo> {
    return this.authSessionService.seedPlaywrightSession(body, e2eSecret, res);
  }
}
