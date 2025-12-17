import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserStore } from './user.store';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private userStore: UserStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const user = client.data?.user;

    if (!user) {
      throw new WsException('Unauthorized');
    }

    return true;
  }

  /**
   * Socket.io handshake 시 JWT 검증
   * handleConnection에서 호출하여 사용
   */
  async verifyClient(client: Socket): Promise<boolean> {
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
