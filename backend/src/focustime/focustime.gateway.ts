import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { FocusTimeService } from './focustime.service';
import { User } from '../auth/user.interface';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { FocusStatus } from './entites/daily-focus-time.entity';
import { MAX_FOCUS_TASK_NAME_LENGTH } from './focustime.constants';
import { exceedsUtf8ByteLimit } from '../util/text-byte.util';

interface AuthenticatedSocket extends Socket {
  data: { user: User };
}

interface FocusingPayload {
  taskName?: string;
  taskId?: number;
}

function normalizeOptionalTaskName(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (exceedsUtf8ByteLimit(trimmed, MAX_FOCUS_TASK_NAME_LENGTH)) {
    return null;
  }

  return trimmed;
}

function parseFocusingPayload(data: unknown): FocusingPayload | null {
  if (data === undefined || data === null) {
    return {};
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const normalizedTaskName = normalizeOptionalTaskName(payload.taskName);
  if (normalizedTaskName === null) {
    return null;
  }

  const taskId = payload.taskId;
  let normalizedTaskId: number | undefined;
  if (taskId !== undefined) {
    if (typeof taskId !== 'number' || Number.isNaN(taskId)) {
      return null;
    }
    normalizedTaskId = taskId;
  }

  return {
    taskName: normalizedTaskName,
    taskId: normalizedTaskId,
  };
}

function parseFocusTaskUpdatingPayload(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const normalizedTaskName = normalizeOptionalTaskName(payload.taskName);
  if (!normalizedTaskName) {
    return null;
  }

  return normalizedTaskName;
}

@WebSocketGateway()
export class FocusTimeGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(FocusTimeGateway.name);

  constructor(
    private readonly focusTimeService: FocusTimeService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  @SubscribeMessage('focusing')
  async handleFocusing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: unknown,
  ) {
    if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

    const parsedData = parseFocusingPayload(data);
    if (!parsedData) {
      this.logger.warn('Invalid focusing payload', {
        method: 'handleFocusing',
        socketId: client.id,
      });
      return { success: false, error: 'Invalid focusing payload' };
    }

    const user = client.data.user;
    this.logger.debug(
      `Received focusing event - data: ${JSON.stringify(parsedData)}`,
    );

    try {
      const player = await this.focusTimeService.startFocusing(
        user.playerId,
        parsedData.taskId,
      );

      const rooms = Array.from(client.rooms);
      const roomId = rooms.find((room) => room !== client.id);

      // 서버에서 현재 세션 경과 시간 계산
      const currentSessionSeconds = player.lastFocusStartTime
        ? Math.floor((Date.now() - player.lastFocusStartTime.getTime()) / 1000)
        : 0;

      // 오늘 누적 시간 조회
      const focusStatus = await this.focusTimeService.getPlayerFocusStatus(
        user.playerId,
      );

      const responseData = {
        userId: client.id,
        username: player.nickname,
        status: FocusStatus.FOCUSING,
        lastFocusStartTime: player.lastFocusStartTime?.toISOString() ?? null,
        totalFocusSeconds: focusStatus.totalFocusSeconds,
        currentSessionSeconds,
        taskName: parsedData.taskName,
      };

      if (roomId) {
        // 방에 있는 다른 사람들에게 집중 중임을 알림
        client.to(roomId).emit('focused', responseData);

        this.logger.log('Focused broadcast', {
          method: 'handleFocusing',
          username: user.username,
          roomId,
          taskName: parsedData.taskName ?? null,
        });
      } else {
        this.logger.warn('Focusing but no room', {
          method: 'handleFocusing',
          username: user.username,
        });
      }

      // 본인에게 응답
      return { success: true, data: responseData };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Focusing error', {
        method: 'handleFocusing',
        username: user.username,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('resting')
  async handleResting(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

    const user = client.data.user;

    try {
      const result = await this.focusTimeService.startResting(user.playerId);

      const rooms = Array.from(client.rooms);
      const roomId = rooms.find((room) => room !== client.id);

      const responseData = {
        userId: client.id,
        username: user.username,
        status: FocusStatus.RESTING,
        totalFocusSeconds: result.totalFocusSeconds,
      };

      if (roomId) {
        // 방에 있는 다른 사람들에게 휴식 중임을 알림
        client.to(roomId).emit('rested', responseData);

        this.logger.log('Rested broadcast', {
          method: 'handleResting',
          username: user.username,
          roomId,
        });
      } else {
        this.logger.warn('Resting but no room', {
          method: 'handleResting',
          username: user.username,
        });
      }

      // 본인에게 응답
      return { success: true, data: responseData };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Resting error', {
        method: 'handleResting',
        username: user.username,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('focus_task_updating')
  handleFocusTaskUpdating(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: unknown,
  ) {
    if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

    const taskName = parseFocusTaskUpdatingPayload(data);
    if (!taskName) {
      this.logger.warn('Invalid focus_task_updating payload', {
        method: 'handleFocusTaskUpdating',
        socketId: client.id,
      });
      return { success: false, error: 'Invalid focus_task_updating payload' };
    }

    const user = client.data.user;

    const rooms = Array.from(client.rooms);
    const roomId = rooms.find((room) => room !== client.id);

    const responseData = {
      userId: client.id,
      username: user.username,
      taskName,
    };

    if (roomId) {
      // 방에 있는 다른 사람들에게 Task 변경 알림
      client.to(roomId).emit('focus_task_updated', responseData);

      this.logger.log('Focus task updated', {
        method: 'handleFocusTaskUpdating',
        username: user.username,
        taskName,
      });
    } else {
      this.logger.warn('focus_task_updating but no room', {
        method: 'handleFocusTaskUpdating',
        username: user.username,
      });
    }

    // 본인에게 응답
    return { success: true, data: responseData };
  }

  async handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = client.data.user;

    if (!user) {
      return;
    }

    try {
      // player 기반 정산 (집중 중이 아니면 무시됨)
      await this.focusTimeService.startResting(user.playerId);
      this.logger.log('Disconnect set resting', {
        method: 'handleDisconnect',
        username: user.username,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Disconnect error', {
        method: 'handleDisconnect',
        username: user.username,
        error: message,
      });
    }
  }
}
