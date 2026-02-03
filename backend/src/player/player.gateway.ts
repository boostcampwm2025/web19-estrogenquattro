import { Logger, OnModuleDestroy } from '@nestjs/common';
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
import { ProgressGateway } from '../github/progress.gateway';
import { RoomService } from '../room/room.service';

import { PlayerService } from './player.service';
import { FocusTimeService } from '../focustime/focustime.service';
import { FocusStatus } from '../focustime/entites/daily-focus-time.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../task/entites/task.entity';

@WebSocketGateway()
export class PlayerGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(PlayerGateway.name);
  private jwtCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly githubService: GithubPollService,
    private readonly progressGateway: ProgressGateway,
    private readonly wsJwtGuard: WsJwtGuard,
    private readonly roomService: RoomService,
    private readonly playerService: PlayerService,
    private readonly focusTimeService: FocusTimeService,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
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
      petImage: string | null; // 펫 이미지 (nullable)
      isListening?: boolean; // 음악 감상 중 여부
    }
  > = new Map();

  // username -> socketId 매핑 (중복 접속 방지용)
  private userSockets: Map<string, string> = new Map();

  afterInit() {
    // 1분마다 모든 연결된 소켓의 JWT 검증
    this.jwtCheckInterval = setInterval(() => {
      this.server.sockets.sockets.forEach((socket) => {
        if (!this.wsJwtGuard.verifyToken(socket)) {
          this.logger.log('JWT expired for socket', { socketId: socket.id });
          socket.emit('auth_expired');
          socket.disconnect();
        }
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.jwtCheckInterval) {
      clearInterval(this.jwtCheckInterval);
    }
  }

  handleConnection(client: Socket) {
    const isValid = this.wsJwtGuard.verifyClient(client);

    if (!isValid) {
      this.logger.warn('Connection rejected (unauthorized)', {
        clientId: client.id,
      });
      client.disconnect();
      return;
    }

    const data = client.data as { user: User };
    const user = data.user;
    this.logger.log('Client connected', {
      clientId: client.id,
      username: user.username,
    });

    // 연결 직후 전역 게임 상태 전송 (joining 전에 맵 로드 가능하도록)
    const globalState = this.progressGateway.getGlobalState();
    client.emit('game_state', globalState);
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
    this.logger.log('Client disconnected', {
      clientId: client.id,
      hadPlayerState: !!player,
    });
  }

  @SubscribeMessage('joining')
  async handleJoin(
    @MessageBody()
    data: { x: number; y: number; username: string; roomId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    // client.data에서 OAuth 인증된 사용자 정보 추출
    const userData = client.data as { user: User };
    const { username, accessToken, playerId } = userData.user;

    let roomId: string;
    try {
      if (data.roomId) {
        roomId = this.roomService.joinRoom(client.id, data.roomId, playerId);
      } else {
        roomId = this.roomService.randomJoin(client.id, playerId);
      }
    } catch (error) {
      const err = error as { message: string; code?: string };
      this.logger.warn('Failed to join room', {
        clientId: client.id,
        requestedRoomId: data.roomId,
        error: err.message,
      });
      client.emit('join_failed', {
        message: err.message,
        code: err.code,
      });
      return;
    }

    // RoomService에 플레이어 등록
    this.roomService.addPlayer(roomId, playerId);

    // 같은 username으로 이미 접속한 세션이 있으면 이전 세션 종료
    const existingSocketId = this.userSockets.get(username);
    if (existingSocketId && existingSocketId !== client.id) {
      const existingSocket = this.server.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        this.logger.log('Disconnecting previous session', {
          username,
          oldSocketId: existingSocketId,
          newSocketId: client.id,
        });
        existingSocket.emit('session_replaced', {
          message: '다른 탭에서 접속하여 현재 세션이 종료됩니다.',
        });
        existingSocket.disconnect(true);
      }
    }

    // username -> socketId 매핑 저장
    this.userSockets.set(username, client.id);

    void client.join(roomId);

    const player = await this.playerService.findOneById(playerId);
    if (!player) {
      this.logger.warn('Player not found', { playerId });
      client.disconnect();
      return;
    }
    const petImage = player.equippedPet?.actualImgUrl ?? null;

    // stale 세션 정리 (장기 미접속 후 재접속 시)
    await this.focusTimeService.settleStaleSession(playerId);

    // 1. 새로운 플레이어 정보 저장
    this.players.set(client.id, {
      socketId: client.id,
      userId: client.id, // 소켓 ID를 유저 ID로 사용 (임시)
      username: username,
      roomId: roomId,
      x: data.x,
      y: data.y,
      playerId: playerId,
      petImage: petImage,
      isListening: false,
    });

    // 2. 방에 있는 플레이어들의 Focus 상태 감지 (player 테이블에서 조회)
    const roomPlayerIds = this.roomService.getPlayerIds(roomId);
    const focusStatuses =
      await this.focusTimeService.findAllStatuses(roomPlayerIds);

    // focusingTaskId가 있는 플레이어들의 Task 정보 조회
    const focusingTaskIds = focusStatuses
      .filter((fs) => fs.focusingTaskId != null)
      .map((fs) => fs.focusingTaskId as number);

    const tasks =
      focusingTaskIds.length > 0
        ? await this.taskRepository
            .createQueryBuilder('task')
            .where('task.id IN (:...ids)', { ids: focusingTaskIds })
            .getMany()
        : [];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    // Map playerId -> status info
    const statusMap = new Map<
      number,
      {
        isFocusing: boolean;
        lastFocusStartTime: Date | null;
        focusingTaskId: number | null;
        taskName: string | null;
      }
    >();
    focusStatuses.forEach((fs) => {
      const task = fs.focusingTaskId ? taskMap.get(fs.focusingTaskId) : null;
      statusMap.set(fs.playerId, {
        isFocusing: fs.isFocusing,
        lastFocusStartTime: fs.lastFocusStartTime,
        focusingTaskId: fs.focusingTaskId,
        taskName: task?.description ?? null,
      });
    });

    // 3. 새로운 플레이어에게 "현재 접속 중인 다른 사람들(같은 방)" 정보 전송
    const existingPlayers = Array.from(this.players.values())
      .filter((p) => p.socketId !== client.id && p.roomId === roomId)
      .map((p) => {
        const status = statusMap.get(p.playerId);

        // 서버에서 현재 세션 경과 시간 계산
        const currentSessionSeconds =
          status?.isFocusing && status?.lastFocusStartTime
            ? Math.floor(
                (Date.now() - status.lastFocusStartTime.getTime()) / 1000,
              )
            : 0;

        return {
          ...p,
          status: status?.isFocusing
            ? FocusStatus.FOCUSING
            : FocusStatus.RESTING,
          lastFocusStartTime: status?.lastFocusStartTime?.toISOString() ?? null,
          totalFocusSeconds: 0, // V2에서는 daily_focus_time 조회 생략 (필요시 추가)
          currentSessionSeconds,
          // FOCUSING 상태일 때만 taskName 반환
          taskName: status?.isFocusing ? status?.taskName : null,
        };
      });

    // 내가 볼 기존 사람들 그리기
    client.emit('players_synced', existingPlayers);

    // 4. 내 FocusTime 상태 조회 (player 기반)
    const myFocusStatus =
      await this.focusTimeService.getPlayerFocusStatus(playerId);

    // 내가 집중 중인 Task 정보 조회
    let myTaskName: string | null = null;
    if (myFocusStatus.focusingTaskId) {
      const myTask = await this.taskRepository.findOne({
        where: { id: myFocusStatus.focusingTaskId },
      });
      myTaskName = myTask?.description ?? null;
    }

    // 5. 남들이 볼 내 캐릭터 그리기 (focusTime 정보 포함)
    client.to(roomId).emit('player_joined', {
      userId: client.id,
      username: username,
      x: data.x,
      y: data.y,
      status: myFocusStatus.isFocusing
        ? FocusStatus.FOCUSING
        : FocusStatus.RESTING,
      totalFocusSeconds: myFocusStatus.totalFocusSeconds,
      currentSessionSeconds: myFocusStatus.currentSessionSeconds,
      playerId: playerId,
      petImage: petImage,
      isListening: false,
      // FOCUSING 상태일 때만 taskName 반환
      taskName: myFocusStatus.isFocusing ? myTaskName : null,
    });

    const connectedAt = new Date();

    this.githubService.subscribeGithubEvent(
      connectedAt,
      client.id,
      roomId,
      username,
      accessToken,
      playerId,
    );

    // 새 클라이언트에게 전역 게임 상태 전송
    const globalState = this.progressGateway.getGlobalState();
    client.emit('game_state', globalState);

    // 6. 로컬 플레이어에게 joined 이벤트 전송 (focusTime 정보 포함)
    client.emit('joined', {
      roomId,
      focusTime: {
        status: myFocusStatus.isFocusing
          ? FocusStatus.FOCUSING
          : FocusStatus.RESTING,
        totalFocusSeconds: myFocusStatus.totalFocusSeconds,
        currentSessionSeconds: myFocusStatus.currentSessionSeconds,
      },
    });
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

  @SubscribeMessage('pet_equipping')
  async handlePetEquip(
    @MessageBody()
    data: { petId: number | null },
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

    const playerState = this.players.get(client.id);
    if (!playerState) return;

    // petId 타입 검사
    if (data.petId !== null && typeof data.petId !== 'number') {
      this.logger.warn('Invalid petId type', { clientId: client.id });
      return;
    }

    // DB에서 플레이어 정보 조회하여 검증
    const playerFromDb = await this.playerService.findOneById(
      playerState.playerId,
    );
    if (!playerFromDb) {
      this.logger.warn('Player not found in DB', {
        playerId: playerState.playerId,
      });
      return;
    }

    // 클라이언트가 보낸 petId와 DB의 equippedPetId가 일치하는지 검증
    if (playerFromDb.equippedPetId !== data.petId) {
      this.logger.warn('Pet mismatch', {
        clientId: client.id,
        clientPetId: data.petId,
        dbPetId: playerFromDb.equippedPetId,
      });
      return;
    }

    // DB에서 검증된 petImage 사용
    const petImage = playerFromDb.equippedPet?.actualImgUrl ?? null;

    // 인메모리 상태 업데이트
    playerState.petImage = petImage;

    // 같은 방 사람들에게 전파 (DB에서 검증된 값 사용)
    client.to(playerState.roomId).emit('pet_equipped', {
      userId: client.id,
      petImage: petImage,
    });
  }

  @SubscribeMessage('music_status')
  handleMusicStatus(
    @MessageBody() data: { isListening: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const player = this.players.get(client.id);
    if (player) {
      player.isListening = data.isListening;
      client.to(player.roomId).emit('player_music_status', {
        userId: client.id,
        isListening: data.isListening,
      });
    }
  }
}
