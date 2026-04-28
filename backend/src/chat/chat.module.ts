import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { ChatGateway } from './chat.gateway';
import { ChatHistory } from './entities/chat-history.entity';
import { ChatHistoryService } from './chat-history.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [AuthModule, RoomModule, TypeOrmModule.forFeature([ChatHistory])],
  controllers: [ChatController],
  providers: [ChatGateway, ChatHistoryService],
})
export class ChatModule {}
