import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RoomService } from '../room/room.service';

@WebSocketGateway()
export class ChatGateway {
  constructor(private readonly roomService: RoomService) {}
  @SubscribeMessage('chatting')
  handleMessage(
    @MessageBody()
    data: {
      message: string;
    },
    @ConnectedSocket()
    client: Socket,
  ) {
    const roomId = this.roomService.getRoomIdBySocketId(client.id);
    if (!roomId) return;
    client
      .to(roomId)
      .emit('chatted', { userId: client.id, message: data.message });
  }
}
