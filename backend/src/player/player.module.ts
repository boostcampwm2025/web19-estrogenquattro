import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';
import { GithubModule } from '../github/github.module';
import { RoomModule } from '../room/room.module';

@Module({
  imports: [GithubModule, AuthModule, RoomModule],
  providers: [PlayerGateway, PlayTimeService],
})
export class PlayerModule {}
