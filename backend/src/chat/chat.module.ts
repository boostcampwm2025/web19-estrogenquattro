import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, RoomModule],
  providers: [ChatGateway],
})
export class ChatModule {}
