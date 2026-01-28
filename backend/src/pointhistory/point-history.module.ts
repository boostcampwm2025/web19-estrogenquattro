import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointHistory } from './entities/point-history.entity';
import { PointHistoryService } from './point-history.service';
import { PointHistoryController } from './point-history.controller';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [TypeOrmModule.forFeature([PointHistory]), PlayerModule],
  controllers: [PointHistoryController],
  providers: [PointHistoryService],
  exports: [PointHistoryService],
})
export class PointHistoryModule {}
