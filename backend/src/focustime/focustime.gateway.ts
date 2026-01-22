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

interface AuthenticatedSocket extends Socket {
  data: { user: User };
}

@WebSocketGateway()
export class FocusTimeGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(FocusTimeGateway.name);

  constructor(private readonly focusTimeService: FocusTimeService) {}

  @SubscribeMessage('focusing')
  async handleFocusing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskName?: string; taskId?: number },
  ) {
    const user = client.data.user;
    this.logger.debug(
      `Received focusing event - data: ${JSON.stringify(data)}`,
    );

    try {
      const focusTime = await this.focusTimeService.startFocusing(
        user.playerId,
        data?.taskId,
      );

      const rooms = Array.from(client.rooms);
      const roomId = rooms.find((room) => room !== client.id);

      // 서버에서 현재 세션 경과 시간 계산
      const currentSessionSeconds = focusTime.lastFocusStartTime
        ? Math.floor(
            (Date.now() - focusTime.lastFocusStartTime.getTime()) / 1000,
          )
        : 0;

      const responseData = {
        userId: client.id,
        username: focusTime.player.nickname,
        status: focusTime.status,
        lastFocusStartTime: focusTime.lastFocusStartTime?.toISOString() ?? null,
        totalFocusSeconds: focusTime.totalFocusSeconds,
        currentSessionSeconds,
        taskName: data?.taskName,
      };

      if (roomId) {
        // 방에 있는 다른 사람들에게 집중 중임을 알림
        client.to(roomId).emit('focused', responseData);

        this.logger.log(
          `User ${user.username} started focusing in room ${roomId}${data?.taskName ? ` (task: ${data.taskName})` : ''}`,
        );
      } else {
        this.logger.warn(
          `User ${user.username} sent focusing but is not in any room`,
        );
      }

      // 본인에게 응답
      return { success: true, data: responseData };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error in handleFocusing for ${user.username}: ${message}`,
      );
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('resting')
  async handleResting(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = client.data.user;

    try {
      const focusTime = await this.focusTimeService.startResting(user.playerId);

      const rooms = Array.from(client.rooms);
      const roomId = rooms.find((room) => room !== client.id);

      const responseData = {
        userId: client.id,
        username: focusTime.player.nickname,
        status: focusTime.status,
        totalFocusSeconds: focusTime.totalFocusSeconds,
      };

      if (roomId) {
        // 방에 있는 다른 사람들에게 휴식 중임을 알림
        client.to(roomId).emit('rested', responseData);

        this.logger.log(
          `User ${user.username} started resting in room ${roomId}`,
        );
      } else {
        this.logger.warn(
          `User ${user.username} sent resting but is not in any room`,
        );
      }

      // 본인에게 응답
      return { success: true, data: responseData };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error in handleResting for ${user.username}: ${message}`,
      );
      return { success: false, error: message };
    }
  }

  @SubscribeMessage('focus_task_updating')
  handleFocusTaskUpdating(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskName: string },
  ) {
    const user = client.data.user;

    const rooms = Array.from(client.rooms);
    const roomId = rooms.find((room) => room !== client.id);

    const responseData = {
      userId: client.id,
      username: user.username,
      taskName: data.taskName,
    };

    if (roomId) {
      // 방에 있는 다른 사람들에게 Task 변경 알림
      client.to(roomId).emit('focus_task_updated', responseData);

      this.logger.log(
        `User ${user.username} updated focus task to: ${data.taskName}`,
      );
    } else {
      this.logger.warn(
        `User ${user.username} sent focus_task_updating but is not in any room`,
      );
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
      await this.focusTimeService.startResting(user.playerId);
      this.logger.log(
        `User ${user.username} disconnected. Setting status to RESTING.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error handling disconnect for user ${user.username}: ${message}`,
      );
    }
  }
}
