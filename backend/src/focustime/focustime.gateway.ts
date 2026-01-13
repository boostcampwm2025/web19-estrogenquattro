import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { FocusTimeService } from './focustime.service';
import { User } from '../auth/user.interface';

@WebSocketGateway()
export class FocusTimeGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(FocusTimeGateway.name);

  constructor(private readonly focusTimeService: FocusTimeService) {}

  @SubscribeMessage('focusing')
  async handleFocusing(@ConnectedSocket() client: Socket) {
    const user = client.data.user as User;
    const focusTime = await this.focusTimeService.startFocusing(user.playerId);

    const rooms = Array.from(client.rooms);
    const roomId = rooms.find((room) => room !== client.id);

    if (roomId) {
      // 방에 있는 사람들에게만 집중 중임을 알림
      client.to(roomId).emit('focused', {
        userId: client.id,
        username: focusTime.player.nickname,
        status: focusTime.status,
        lastFocusStartTime: focusTime.lastFocusStartTime,
      });

      this.logger.log(
        `User ${user.username} started focusing in room ${roomId}`,
      );
    } else {
      this.logger.warn(
        `User ${user.username} sent focusing but is not in any room`,
      );
    }
  }

  @SubscribeMessage('resting')
  async handleResting(@ConnectedSocket() client: Socket) {
    const user = client.data.user as User;

    const focusTime = await this.focusTimeService.startResting(user.playerId);

    const rooms = Array.from(client.rooms);
    const roomId = rooms.find((room) => room !== client.id);

    if (roomId) {
      client.to(roomId).emit('rested', {
        userId: client.id,
        username: focusTime.player.nickname,
        status: focusTime.status,
        totalFocusMinutes: focusTime.totalFocusMinutes,
      });

      this.logger.log(
        `User ${user.username} started resting in room ${roomId}`,
      );
    } else {
      this.logger.warn(
        `User ${user.username} sent resting but is not in any room`,
      );
    }
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const user = client.data.user as User;

    if (!user) {
      return;
    }

    try {
      await this.focusTimeService.startResting(user.playerId);
      this.logger.log(
        `User ${user.username} disconnected. Setting status to RESTING.`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling disconnect for user ${user.username}: ${error.message}`,
      );
    }
  }
}
