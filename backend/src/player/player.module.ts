import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { GithubModule } from '../github/github.module';
import { RoomModule } from '../room/room.module';
import { Player } from './entites/player.entity';

import { FocusTimeModule } from '../focustime/focustime.module';
import { PetModule } from '../userpet/pet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Player]),
    GithubModule,
    RoomModule,
    forwardRef(() => AuthModule),
    forwardRef(() => FocusTimeModule),
    PetModule,
  ],
  controllers: [PlayerController],
  providers: [PlayerGateway, PlayerService],
  exports: [TypeOrmModule, PlayerService],
})
export class PlayerModule {}
