import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { userStore } from '../services/userStore.js';
import { playTimeService } from '../services/playTimeService.js';
import { logger } from '../config/logger.js';
import type { User, JwtPayload } from '../services/types.js';

// GitHub 이벤트 데이터 타입
export interface GithubEventData {
  username: string;
  pushCount: number;
  pullRequestCount: number;
}

// 룸 상태 타입
export interface RoomGithubState {
  progress: number;
  contributions: Record<string, number>; // username -> count
}

// 프로그레스 증가량 설정 (프론트엔드와 동일)
const PROGRESS_PER_COMMIT = 2;
const PROGRESS_PER_PR = 5;

// 플레이어 정보
interface PlayerInfo {
  socketId: string;
  userId: string;
  username: string;
  roomId: string;
  x: number;
  y: number;
}

// 접속한 플레이어들의 상태 저장 (메모리)
const players = new Map<string, PlayerInfo>();

// username -> socketId 매핑 (중복 접속 방지용)
const userSockets = new Map<string, string>();

// 룸별 기여 상태 저장
const roomStates = new Map<string, RoomGithubState>();

// 룸 상태 조회
export function getRoomState(roomId: string): RoomGithubState {
  return roomStates.get(roomId) || { progress: 0, contributions: {} };
}

// 룸 상태 업데이트
export function updateRoomState(roomId: string, event: GithubEventData): void {
  let state = roomStates.get(roomId);
  if (!state) {
    state = { progress: 0, contributions: {} };
    roomStates.set(roomId, state);
  }

  // 프로그레스 업데이트
  const progressIncrement =
    event.pushCount * PROGRESS_PER_COMMIT +
    event.pullRequestCount * PROGRESS_PER_PR;
  state.progress = (state.progress + progressIncrement) % 100;

  // 기여도 업데이트
  const totalCount = event.pushCount + event.pullRequestCount;
  state.contributions[event.username] =
    (state.contributions[event.username] || 0) + totalCount;
}

// GitHub 이벤트를 룸에 브로드캐스트
export function castGithubEventToRoom(
  io: Server,
  githubEvent: GithubEventData,
  roomId: string,
): void {
  updateRoomState(roomId, githubEvent);
  io.to(roomId).emit('github_event', githubEvent);
}

// JWT 토큰에서 사용자 정보 추출
function extractUserFromSocket(socket: Socket): User | null {
  try {
    const cookies = socket.handshake.headers?.cookie;
    if (!cookies) return null;

    const tokenMatch = cookies.match(/access_token=([^;]+)/);
    if (!tokenMatch) return null;

    const token = tokenMatch[1];
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    const user = userStore.findByGithubId(payload.sub);

    return user || null;
  } catch {
    return null;
  }
}

// 플레이어 정보 조회 (외부에서 사용)
export function getPlayers(): Map<string, PlayerInfo> {
  return players;
}

export function setupSocketHandlers(io: Server): void {
  // JWT 검증 미들웨어
  io.use((socket, next) => {
    const user = extractUserFromSocket(socket);

    if (!user) {
      logger.warn(`Socket connection rejected (unauthorized): ${socket.id}`);
      return next(new Error('Unauthorized'));
    }

    // Socket에 사용자 정보 저장
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as User;
    logger.info(`Client connected: ${socket.id} (user: ${user.username})`);

    // 방 입장
    socket.on(
      'joining',
      (data: { x: number; y: number; username: string; roomId: string }) => {
        const roomId = data.roomId || 'default-room';
        const { username, accessToken } = user;

        // 같은 username으로 이미 접속한 세션이 있으면 이전 세션 종료
        const existingSocketId = userSockets.get(username);
        if (existingSocketId && existingSocketId !== socket.id) {
          const existingSocket = io.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            logger.info(
              `Disconnecting previous session for ${username}: ${existingSocketId}`,
            );
            existingSocket.emit('session_replaced', {
              message: '다른 탭에서 접속하여 현재 세션이 종료됩니다.',
            });
            existingSocket.disconnect(true);
          }
        }

        // username -> socketId 매핑 저장
        userSockets.set(username, socket.id);

        void socket.join(roomId);

        // 새로운 플레이어 정보 저장
        players.set(socket.id, {
          socketId: socket.id,
          userId: socket.id,
          username: username,
          roomId: roomId,
          x: data.x,
          y: data.y,
        });

        // 새로운 플레이어에게 "현재 접속 중인 다른 사람들(같은 방)" 정보 전송
        const existingPlayers = Array.from(players.values()).filter(
          (p) => p.socketId !== socket.id && p.roomId === roomId,
        );
        socket.emit('players_synced', existingPlayers);

        // 남들이 볼 내 캐릭터 그리기
        socket.to(roomId).emit('player_joined', {
          userId: socket.id,
          username: username,
          x: data.x,
          y: data.y,
        });

        // 타이머 시작
        const connectedAt = new Date();
        playTimeService.startTimer(
          socket.id,
          username,
          (minutes) => {
            io.to(roomId).emit('timerUpdated', {
              userId: socket.id,
              minutes,
            });
          },
          connectedAt,
        );

        // TODO: GitHub 폴링 서비스 구독 (Phase 2.4)
        // githubPollService.subscribe(...)

        // 새 클라이언트에게 현재 룸의 기여 상태 전송
        socket.emit('github_state', getRoomState(roomId));

        // 새 클라이언트에게 같은 방의 모든 사용자 접속시간 전송
        const roomPlayers = Array.from(players.values()).filter(
          (p) => p.roomId === roomId,
        );
        for (const player of roomPlayers) {
          const minutes = playTimeService.getUserMinutes(player.username);
          if (minutes > 0) {
            socket.emit('timerUpdated', {
              userId: player.socketId,
              minutes,
            });
          }
        }

        // accessToken 사용 (나중에 GitHub 폴링에서 사용)
        logger.debug(`User ${username} has accessToken: ${!!accessToken}`);
      },
    );

    // 이동
    socket.on(
      'moving',
      (data: {
        roomId: string;
        x: number;
        y: number;
        isMoving: boolean;
        direction: string;
        timestamp: number;
      }) => {
        // 플레이어 위치 최신화
        const player = players.get(socket.id);
        if (player) {
          player.x = data.x;
          player.y = data.y;
        }

        // 같은 방 사람들에게만 이동 정보 전송
        socket.to(data.roomId).emit('moved', {
          userId: socket.id,
          x: data.x,
          y: data.y,
          isMoving: data.isMoving,
          direction: data.direction,
          timestamp: data.timestamp,
        });
      },
    );

    // 연결 해제
    socket.on('disconnect', () => {
      const player = players.get(socket.id);
      if (player) {
        players.delete(socket.id);
        io.to(player.roomId).emit('player_left', { userId: socket.id });
        playTimeService.stopTimer(socket.id);

        // TODO: GitHub 폴링 서비스 구독 해제 (Phase 2.4)
        // githubPollService.unsubscribe(socket.id);

        // userSockets 매핑 제거 (현재 소켓이 해당 유저의 활성 소켓인 경우만)
        if (userSockets.get(player.username) === socket.id) {
          userSockets.delete(player.username);
        }
      }
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
}
