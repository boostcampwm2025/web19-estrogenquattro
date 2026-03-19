import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Notice } from './entities/notice.entity';

@WebSocketGateway()
export class NoticeGateway {
  @WebSocketServer()
  server: Server;

  broadcastNotice(notice: Notice) {
    this.server.emit('noticed', {
      noticeId: notice.id,
      ko: { title: notice.titleKo, content: notice.contentKo },
      en: { title: notice.titleEn, content: notice.contentEn },
      createdAt: notice.createdAt,
    });
  }
}
