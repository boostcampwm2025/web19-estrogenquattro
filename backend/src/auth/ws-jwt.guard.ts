import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserStore } from './user.store';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private userStore: UserStore,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const data = client.data as { user?: unknown };
    const user = data?.user;

    if (!user) {
      throw new WsException('Unauthorized');
    }

    return true;
  }

  /**
   * Socket.io handshake 시 JWT 검증
   * handleConnection에서 호출하여 사용
   */
  verifyClient(client: Socket): boolean {
    try {
      const token = this.extractToken(client);

      if (!token) {
        return false;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = this.userStore.findByGithubId(payload.sub);

      if (!user) {
        return false;
      }

      // Socket에 사용자 정보 저장
      client.data = { user };

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`verifyClient failed: ${message}`);
      return false;
    }
  }

  /**
   * 소켓의 JWT 토큰이 유효한지 검증
   * 주기적 검증에서 사용
   */
  verifyToken(client: Socket): boolean {
    try {
      const token = this.extractToken(client);
      if (!token) {
        return false;
      }
      this.jwtService.verify(token);
      return true;
    } catch {
      return false;
    }
  }

  private extractToken(client: Socket): string | null {
    // 쿠키에서 추출
    const cookies = client.handshake.headers?.cookie;
    if (cookies) {
      const tokenMatch = cookies.match(/access_token=([^;]+)/);
      if (tokenMatch) {
        return tokenMatch[1];
      }
    }

    return null;
  }
}
