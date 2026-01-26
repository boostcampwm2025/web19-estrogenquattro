import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointHistory } from './entities/point-history.entity';
import { PointHistoryService } from './point-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([PointHistory])],
  providers: [PointHistoryService],
  exports: [PointHistoryService],
})
export class PointHistoryModule {}
