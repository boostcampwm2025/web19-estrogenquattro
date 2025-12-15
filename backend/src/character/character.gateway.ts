import {ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway} from '@nestjs/websockets';
import {Socket} from "socket.io";
import {MoveReq} from "./dto/move.dto";

@WebSocketGateway()
export class CharacterGateway {
  @SubscribeMessage('move')
  handleMove(
    @MessageBody()
    data: MoveReq,
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.roomId).emit('moved', {
      userId: client.id,
      x: data.x,
      y: data.y,
      direction: data.direction,
    });
  }
}
