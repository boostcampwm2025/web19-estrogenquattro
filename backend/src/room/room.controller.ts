import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtGuard } from 'src/auth/jwt.guard';
import { PlayerId } from 'src/auth/player-id.decorator';

@Controller('api/rooms')
@UseGuards(JwtGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  getRooms() {
    return this.roomService.getAllRooms();
  }

  @Patch(':roomId')
  joinRoom(@Param('roomId') roomId: string, @PlayerId() playerId: number) {
    this.roomService.reserveRoom(playerId, roomId);
  }
}
