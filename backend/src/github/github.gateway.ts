import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface GithubEventData {
  username: string;
  pushCount: number;
  pullRequestCount: number;
}

@WebSocketGateway()
export class GithubGateway {
  @WebSocketServer()
  server: Server;

  public castGithubEventToRoom(githubEvent: GithubEventData, roomId: string) {
    this.server.to(roomId).emit('github_event', githubEvent);
  }
}
