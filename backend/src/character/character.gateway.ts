import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { MoveReq } from './dto/move.dto';
import { CharacterService } from './character.service';

@WebSocketGateway()
export class CharacterGateway {
  constructor(private readonly characterService: CharacterService) {}

  @SubscribeMessage('moving')
  handleMove(
    @MessageBody()
    data: MoveReq,
    @ConnectedSocket() client: Socket,
  ) {
    client.to(data.roomId).emit('moved', {
      userId: client.id,
      direction: data.direction,
    });
  }

  @SubscribeMessage('joining')
  handleJoinRoom(@ConnectedSocket() client: Socket) {
    this.characterService.startSessionTimer(
      client.id,
      this.createTimerCallback(client),
    );
  }

  private createTimerCallback(client: Socket) {
    return (minutes: number) => {
      // roomId는 추후 방 배정 이후 수정 필요
      client.to('roomId').emit('timerUpdated', {
        userId: client.id,
        minutes,
      });
    };
  }
}
