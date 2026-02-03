import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtGuard } from 'src/auth/jwt.guard';

@Controller('api/rooms')
@UseGuards(JwtGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  getRooms() {
    return this.roomService.getAllRoomPlayers();
  }
}
