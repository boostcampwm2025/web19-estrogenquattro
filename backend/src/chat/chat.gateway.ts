import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RoomService } from '../room/room.service';
import { WsJwtGuard } from '../auth/ws-jwt.guard';

@WebSocketGateway()
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly roomService: RoomService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  @SubscribeMessage('chatting')
  handleMessage(
    @MessageBody()
    data: {
      message: string;
    },
    @ConnectedSocket()
    client: Socket,
  ) {
    if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

    const roomId = this.roomService.getRoomIdBySocketId(client.id);
    if (!roomId) return;
    client
      .to(roomId)
      .emit('chatted', { userId: client.id, message: data.message });
  }
}
