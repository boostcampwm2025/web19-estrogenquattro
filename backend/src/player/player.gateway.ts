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
import { GithubPollService } from '../github/github.poll-service';
import { GithubGateway } from '../github/github.gateway';
import { RoomService } from '../room/room.service';

import { PlayerService } from './player.service';
import { FocusTimeService } from '../focustime/focustime.service';

@WebSocketGateway()
export class PlayerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PlayerGateway.name);

  constructor(
    private readonly githubService: GithubPollService,
    private readonly githubGateway: GithubGateway,
    private readonly wsJwtGuard: WsJwtGuard,
    private readonly roomService: RoomService,
    private readonly playerService: PlayerService,
    private readonly focusTimeService: FocusTimeService,
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
      playerId: number;
    }
  > = new Map();

  // username -> socketId 매핑 (중복 접속 방지용)
  private userSockets: Map<string, string> = new Map();

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
      this.githubService.unsubscribeGithubEvent(client.id);
      this.roomService.exit(client.id);
      this.roomService.removePlayer(player.roomId, player.playerId);

      // userSockets 매핑 제거 (현재 소켓이 해당 유저의 활성 소켓인 경우만)
      if (this.userSockets.get(player.username) === client.id) {
        this.userSockets.delete(player.username);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joining')
  async handleJoin(
    @MessageBody()
    data: { x: number; y: number; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = this.roomService.randomJoin(client.id);

    // client.data에서 OAuth 인증된 사용자 정보 추출
    const userData = client.data as { user: User };
    const { username, accessToken, playerId } = userData.user;

    // RoomService에 플레이어 등록
    this.roomService.addPlayer(roomId, playerId);

    // 같은 username으로 이미 접속한 세션이 있으면 이전 세션 종료
    const existingSocketId = this.userSockets.get(username);
    if (existingSocketId && existingSocketId !== client.id) {
      const existingSocket = this.server.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        this.logger.log(
          `Disconnecting previous session for ${username}: ${existingSocketId}`,
        );
        existingSocket.emit('session_replaced', {
          message: '다른 탭에서 접속하여 현재 세션이 종료됩니다.',
        });
        existingSocket.disconnect(true);
      }
    }

    // username -> socketId 매핑 저장
    this.userSockets.set(username, client.id);

    void client.join(roomId);

    // 1. 새로운 플레이어 정보 저장
    this.players.set(client.id, {
      socketId: client.id,
      userId: client.id, // 소켓 ID를 유저 ID로 사용 (임시)
      username: username,
      roomId: roomId,
      x: data.x,
      y: data.y,
      playerId: playerId,
    });

    // 2. 방에 있는 플레이어들의 Focus 상태 감지
    const roomPlayerIds = this.roomService.getPlayerIds(roomId);
    const focusStatuses =
      await this.focusTimeService.findAllStatuses(roomPlayerIds);
    // Map playerId -> status info
    const statusMap = new Map<
      number,
      {
        status: string;
        lastFocusStartTime: Date | null;
        totalFocusMinutes: number;
      }
    >();
    focusStatuses.forEach((fs) => {
      statusMap.set(fs.player.id, {
        status: fs.status,
        lastFocusStartTime: fs.lastFocusStartTime,
        totalFocusMinutes: fs.totalFocusMinutes,
      });
    });

    // 2. 새로운 플레이어에게 "현재 접속 중인 다른 사람들(같은 방)" 정보 전송
    const existingPlayers = Array.from(this.players.values())
      .filter((p) => p.socketId !== client.id && p.roomId === roomId)
      .map((p) => {
        const status = statusMap.get(p.playerId);
        return {
          ...p,
          status: status?.status ?? 'RESTING',
          lastFocusStartTime: status?.lastFocusStartTime ?? null,
          totalFocusMinutes: status?.totalFocusMinutes ?? 0,
        };
      });

    //내가 볼 기존 사람들 그리기
    client.emit('players_synced', existingPlayers);

    //남들이 볼 내 캐릭터 그리기
    client.to(roomId).emit('player_joined', {
      userId: client.id,
      username: username,
      x: data.x,
      y: data.y,
    });

    // 4. Update FocusTime
    const player = await this.playerService.findOneById(userData.user.playerId);
    await this.focusTimeService.findOrCreate(player);

    const connectedAt = new Date();

    this.githubService.subscribeGithubEvent(
      connectedAt,
      client.id,
      roomId,
      username,
      accessToken,
    );

    // 새 클라이언트에게 현재 룸의 기여 상태 전송
    const roomState = this.githubGateway.getRoomState(roomId);
    client.emit('github_state', roomState);
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
    if (!player) return;

    // 같은 방 사람들에게만 이동 정보 전송
    client.to(player.roomId).emit('moved', {
      userId: client.id, // 항상 소켓 ID를 기준으로 브로드캐스트
      x: data.x,
      y: data.y,
      isMoving: data.isMoving,
      direction: data.direction,
      timestamp: data.timestamp,
    });
  }
}
