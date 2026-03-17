import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Notice } from './entities/notice.entity';

@WebSocketGateway()
export class NoticeGateway {
  @WebSocketServer()
  server: Server;

  broadcastNotice(notice: Notice) {
    this.server.emit('noticed', {
      title: notice.title,
      content: notice.content,
      createdAt: notice.createdAt,
    });
  }
}

