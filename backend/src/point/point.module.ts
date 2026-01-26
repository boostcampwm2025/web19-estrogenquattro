import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyPoint } from './entities/daily-point.entity';
import { PointHistoryModule } from '../pointhistory/point-history.module';

import { PointService } from './point.service';
import { PointController } from './point.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyPoint]), PointHistoryModule],
  controllers: [PointController],
  providers: [PointService],
  exports: [PointService],
})
export class PointModule {}
