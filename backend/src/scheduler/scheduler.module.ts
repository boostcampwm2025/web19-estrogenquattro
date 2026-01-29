import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { PointModule } from '../point/point.module';
import { GithubModule } from '../github/github.module';
import { PointSettlementScheduler } from './point-settlement.scheduler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([DailyFocusTime, Task]),
    PointModule,
    GithubModule,
  ],
  providers: [PointSettlementScheduler],
})
export class SchedulerModule {}
