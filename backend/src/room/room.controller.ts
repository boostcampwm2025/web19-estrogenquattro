import { Controller, Get } from '@nestjs/common';
import { RoomService } from './room.service';

@Controller('api/rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  getRooms() {
    return this.roomService.getAllRoomPlayers();
  }
}
