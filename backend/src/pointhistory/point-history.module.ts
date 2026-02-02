import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointHistory } from './entities/point-history.entity';
import { PointHistoryService } from './point-history.service';
import { PointHistoryController } from './point-history.controller';
import { Player } from '../player/entites/player.entity';
import { FocusTimeModule } from '../focustime/focustime.module';

@Module({
  imports: [TypeOrmModule.forFeature([PointHistory, Player]), FocusTimeModule],
  controllers: [PointHistoryController],
  providers: [PointHistoryService],
  exports: [PointHistoryService],
})
export class PointHistoryModule {}
