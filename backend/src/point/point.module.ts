import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyPoint } from './entities/daily-point.entity';

import { PointService } from './point.service';
import { PointController } from './point.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyPoint])],
  controllers: [PointController],
  providers: [PointService],
})
export class PointModule {}
