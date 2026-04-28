import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { User } from '../auth/user.interface';
import { RoomService } from '../room/room.service';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { CHAT_MAX_LENGTH } from './chat.constants';
import { getUtf8ByteLength } from '../util/text-byte.util';
import { ChatHistoryService } from './chat-history.service';

interface ChatMessage {
  message: string;
  nickname: string;
}

function isChatMessage(data: unknown): data is ChatMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as ChatMessage).message === 'string' &&
    'nickname' in data &&
    typeof (data as ChatMessage).nickname === 'string'
  );
}

@WebSocketGateway()
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly roomService: RoomService,
    private readonly wsJwtGuard: WsJwtGuard,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  @SubscribeMessage('chatting')
  async handleMessage(
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
    const nickname = data.nickname.trim();
    if (nickname.length === 0 || nickname.length > 20) {
      this.logger.warn(`Invalid nickname length: ${nickname.length}`);
      return;
    }

    const roomId = this.roomService.getRoomIdBySocketId(client.id);
    if (!roomId) return;

    const userData = client.data as { user?: User };
    const user = userData.user;
    if (!user) {
      this.logger.warn('User data not set, rejecting chat', {
        clientId: client.id,
      });
      return;
    }

    const saved = await this.chatHistoryService.create(
      user.playerId,
      roomId,
      nickname,
      data.message,
    );

    client.nsp.to(roomId).emit('chatted', {
      id: saved.id,
      userId: client.id,
      nickname: saved.nickname,
      message: saved.message,
      createdAt: saved.createdAt,
    });
  }
}
