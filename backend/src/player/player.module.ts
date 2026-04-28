import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { GithubModule } from '../github/github.module';
import { RoomModule } from '../room/room.module';
import { Player } from './entites/player.entity';
import { Task } from '../task/entites/task.entity';
import { PointHistory } from '../pointhistory/entities/point-history.entity';
import { DatabaseModule } from '../database/database.module';

import { FocusTimeModule } from '../focustime/focustime.module';
import { PetModule } from '../userpet/pet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Player, Task, PointHistory]),
    GithubModule,
    RoomModule,
    DatabaseModule,
    forwardRef(() => AuthModule),
    forwardRef(() => FocusTimeModule),
    PetModule,
  ],
  controllers: [PlayerController],
  providers: [PlayerGateway, PlayerService],
  exports: [TypeOrmModule, PlayerService, PlayerGateway],
})
export class PlayerModule {}
