import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MoveReq } from './dto/move.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class CharacterGateway {
  @WebSocketServer()
  server: Server;

  // 접속한 플레이어들의 상태 저장 (메모리)
  private players: Map<
    string,
    {
      socketId: string;
      userId: string;
      username: string;
      roomId: string;
      x: number;
      y: number;
    }
  > = new Map();

  @SubscribeMessage('moving')
  handleMove(
    @MessageBody()
    data: MoveReq,
    @ConnectedSocket() client: Socket,
  ) {
    // 플레이어 위치 최신화
    const player = this.players.get(client.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
    }

    // 같은 방 사람들에게만 이동 정보 전송
    client.to(data.roomId).emit('moved', {
      userId: client.id, // 항상 소켓 ID를 기준으로 브로드캐스트
      x: data.x,
      y: data.y,
      isMoving: data.isMoving,
      direction: data.direction,
      timestamp: data.timestamp,
    });
  }
}
