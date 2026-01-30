import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GithubGuard extends AuthGuard('github') {
  private readonly logger = new Logger(GithubGuard.name);

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    info: Error | null,
  ): TUser {
    if (err || !user) {
      const errorMessage = err?.message || info?.message || 'Unknown error';

      this.logger.error(`GitHub OAuth failed: ${errorMessage}`, err?.stack);

      // OAuth 에러 상세 정보 로깅
      if (err && 'oauthError' in err) {
        const oauthErr = err as Error & { oauthError?: unknown };
        this.logger.error(
          `OAuth error details: ${JSON.stringify(oauthErr.oauthError)}`,
        );
      }

      throw err ?? new UnauthorizedException('GitHub 인증 실패');
    }
    return user;
  }
}
