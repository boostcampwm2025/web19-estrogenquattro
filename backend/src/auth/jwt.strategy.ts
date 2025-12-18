import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UserStore } from './user.store';

export interface JwtPayload {
  sub: string; // githubId
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private userStore: UserStore,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = req?.cookies?.access_token as string | null;
          this.logger.debug(
            `Extracting token from cookies: ${token ? 'found' : 'not found'}`,
          );
          return token;
        },
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    this.logger.debug(`Validating payload for user: ${payload.username}`);
    const user = this.userStore.findByGithubId(payload.sub);
    this.logger.debug(`User found: ${user ? 'yes' : 'no'}`);
    return user || false;
  }
}
