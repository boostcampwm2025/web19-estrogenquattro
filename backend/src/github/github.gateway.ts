import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class GithubGateway {
  @WebSocketServer()
  server: Server;

  public castGithubEventToRoom(githubEvent: any, roomId: string) {
    this.server.to(roomId).emit(githubEvent);
  }
}
