import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';
import { PlayerService } from './player.service';
import { GithubModule } from '../github/github.module';
import { RoomModule } from '../room/room.module';
import { Player } from './entites/player.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Player]),
    GithubModule,
    RoomModule,
    forwardRef(() => AuthModule),
  ],
  providers: [PlayerGateway, PlayTimeService, PlayerService],
  exports: [TypeOrmModule, PlayerService],
})
export class PlayerModule {}
