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
import { CHAT_MAX_LENGTH } from './chat.constants';
import { getUtf8ByteLength } from '../util/text-byte.util';

interface ChatMessage {
  message: string;
}

function isChatMessage(data: unknown): data is ChatMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as ChatMessage).message === 'string'
  );
}

@WebSocketGateway()
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly roomService: RoomService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  @SubscribeMessage('chatting')
  handleMessage(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

    // 1. 타입 검증
    if (!isChatMessage(data)) {
      this.logger.warn(`Invalid message payload: ${typeof data}`);
      return;
    }

    // 2. 내용 검증: 공백만 있거나 UTF-8 바이트 길이 초과
    const messageBytes = getUtf8ByteLength(data.message);
    if (data.message.trim().length === 0 || messageBytes > CHAT_MAX_LENGTH) {
      this.logger.warn(`Invalid message: bytes=${messageBytes}`);
      return;
    }

    const roomId = this.roomService.getRoomIdBySocketId(client.id);
    if (!roomId) return;
    client
      .to(roomId)
      .emit('chatted', { userId: client.id, message: data.message });
  }
}
