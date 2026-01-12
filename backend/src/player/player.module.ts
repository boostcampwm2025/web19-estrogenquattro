import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';
import { GithubModule } from '../github/github.module';
import { RoomModule } from '../room/room.module';
import { Player } from './entites/player.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Player]),
    GithubModule,
    AuthModule,
    RoomModule,
  ],
  providers: [PlayerGateway, PlayTimeService],
  exports: [TypeOrmModule],
})
export class PlayerModule {}
