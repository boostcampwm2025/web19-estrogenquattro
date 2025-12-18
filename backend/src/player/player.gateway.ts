import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { User } from '../auth/user.interface';
import { MoveReq } from './dto/move.dto';
import { PlayTimeService } from './player.play-time-service';
import { GithubPollService } from '../github/github.poll-service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class PlayerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PlayerGateway.name);

  constructor(
    private readonly playTimeService: PlayTimeService,
    private readonly githubService: GithubPollService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}
  @WebSocketServer()
  server: Server;

  // 접속한 플레이어들의 상태 저장 (메모리)
  private players: Map<
    string,
    {
      socketId: string;
      userId: string;
      username: string;
      roomId: string;
      x: number;
      y: number;
    }
  > = new Map();

  handleConnection(client: Socket) {
    const isValid = this.wsJwtGuard.verifyClient(client);

    if (!isValid) {
      this.logger.warn(`Connection rejected (unauthorized): ${client.id}`);
      client.disconnect();
      return;
    }

    const data = client.data as { user: User };
    const user = data.user;
    this.logger.log(`Client connected: ${client.id} (user: ${user.username})`);
  }

  handleDisconnect(client: Socket) {
    const player = this.players.get(client.id);
    if (player) {
      this.players.delete(client.id);
      this.server.to(player.roomId).emit('player_left', { userId: client.id });
      this.playTimeService.stopTimer(client.id);
      this.githubService.unsubscribeGithubEvent(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joining')
  handleJoin(
    @MessageBody()
    data: { x: number; y: number; username: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data.roomId || 'default-room';
    void client.join(roomId);

    // 1. 새로운 플레이어 정보 저장
    this.players.set(client.id, {
      socketId: client.id,
      userId: client.id, // 소켓 ID를 유저 ID로 사용 (임시)
      username: data.username || 'Tester', // 유저네임 저장
      roomId: roomId,
      x: data.x,
      y: data.y,
    });

    // 2. 새로운 플레이어에게 "현재 접속 중인 다른 사람들(같은 방)" 정보 전송
    const existingPlayers = Array.from(this.players.values()).filter(
      (p) => p.socketId !== client.id && p.roomId === roomId,
    );
    //내가 볼 기존 사람들 그리기
    client.emit('players_synced', existingPlayers);

    //남들이 볼 내 캐릭터 그리기
    client.to(roomId).emit('player_joined', {
      userId: client.id,
      username: data.username || 'Tester',
      x: data.x,
      y: data.y,
    });

    const connectedAt = new Date();
    this.playTimeService.startTimer(
      client.id,
      this.createTimerCallback(client),
      connectedAt,
    );

    // client.data에서 OAuth 인증된 사용자 정보 추출
    const userData = client.data as { user: User };
    const { username, accessToken } = userData.user;
    this.githubService.subscribeGithubEvent(
      connectedAt,
      client.id,
      roomId,
      username,
      accessToken,
    );
  }

  @SubscribeMessage('moving')
  handleMove(
    @MessageBody()
    data: MoveReq,
    @ConnectedSocket() client: Socket,
  ) {
    // 플레이어 위치 최신화
    const player = this.players.get(client.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
    }

    // 같은 방 사람들에게만 이동 정보 전송
    client.to(data.roomId).emit('moved', {
      userId: client.id, // 항상 소켓 ID를 기준으로 브로드캐스트
      x: data.x,
      y: data.y,
      isMoving: data.isMoving,
      direction: data.direction,
      timestamp: data.timestamp,
    });
  }

  private createTimerCallback(client: Socket) {
    return (minutes: number) => {
      // roomId는 추후 방 배정 이후 수정 필요
      const player = this.players.get(client.id);
      this.server.to(player!.roomId).emit('timerUpdated', {
        userId: client.id,
        minutes,
      });
    };
  }
}
